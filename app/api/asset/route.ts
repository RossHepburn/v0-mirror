// Same-origin asset proxy used to serve cross-origin fonts (and other assets
// blocked by CORS) from our own origin so the browser will use them. Fetched
// server-side via Bright Data, cached in Upstash KV for 24h.
//
// Security: HTTP/HTTPS only, no localhost / private IPs / link-local.

import { Redis } from "@upstash/redis";
import { fetchAssetViaBrightData } from "@/lib/bright-data";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const ASSET_TTL_SECONDS = 60 * 60 * 24;
const MAX_CACHE_BYTES = 900 * 1024; // ~900KB — anything larger goes uncached

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./, // link-local
  /^0\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
];

function isPrivateHost(host: string): boolean {
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) return true;
  // 172.16.0.0/12
  const m = host.match(/^172\.(\d+)\./);
  if (m) {
    const second = parseInt(m[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function validateAssetUrl(input: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "only http(s) allowed" };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, reason: "blocked host (private/loopback)" };
  }
  return { ok: true, url: parsed };
}

const EXT_MIME: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  svg: "image/svg+xml",
  css: "text/css; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
};

function guessContentType(url: URL, upstream: string | null): string {
  if (upstream && !/octet-stream/i.test(upstream)) return upstream;
  const m = url.pathname.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
  const ext = m?.[1];
  return (ext && EXT_MIME[ext]) || upstream || "application/octet-stream";
}

const assetKey = (url: string, rewrite: boolean) =>
  `asset:${rewrite ? "css:" : ""}${crypto.createHash("sha256").update(url).digest("hex").slice(0, 32)}`;

type CachedAsset = { ct: string; b64: string };

const FONT_EXT_RE = /\.(woff2|woff|ttf|otf|eot)(\?|#|$)/i;
const CSS_URL_RE = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/g;
const CSS_IMPORT_RE = /@import\s+(?:url\()?\s*(['"])([^'"]+)\1\s*\)?/g;

function rewriteCssBody(css: string, base: URL, requestOrigin: string): string {
  // Rewrite font url(...) → /api/asset?u=
  let out = css.replace(CSS_URL_RE, (_m, q, ref) => {
    if (!ref || ref.startsWith("data:")) return `url(${q}${ref}${q})`;
    let abs: string;
    try {
      abs = new URL(ref, base).toString();
    } catch {
      return `url(${q}${ref}${q})`;
    }
    if (FONT_EXT_RE.test(abs)) {
      return `url(${q}${requestOrigin}/api/asset?u=${encodeURIComponent(abs)}${q})`;
    }
    return `url(${q}${abs}${q})`;
  });
  // Resolve @import urls so nested CSS still loads from the right origin
  // (we don't recursively proxy them — keep it simple).
  out = out.replace(CSS_IMPORT_RE, (_m, q, ref) => {
    try {
      const abs = new URL(ref, base).toString();
      return `@import url(${q}${requestOrigin}/api/asset?u=${encodeURIComponent(abs)}&rewrite=css${q})`;
    } catch {
      return `@import url(${q}${ref}${q})`;
    }
  });
  return out;
}

export async function GET(req: Request): Promise<Response> {
  const reqUrl = new URL(req.url);
  const u = reqUrl.searchParams.get("u");
  if (!u) {
    return new Response("missing ?u=", { status: 400 });
  }
  const rewrite = reqUrl.searchParams.get("rewrite") === "css";

  const validation = validateAssetUrl(u);
  if (!validation.ok) {
    return new Response(validation.reason, { status: 400 });
  }
  const target = validation.url;
  const requestOrigin = `${reqUrl.protocol}//${reqUrl.host}`;

  // 1. KV cache (rewritten CSS cached separately)
  try {
    const cached = await kv.get<CachedAsset>(assetKey(target.toString(), rewrite));
    if (cached) {
      const bytes = Buffer.from(cached.b64, "base64");
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: assetHeaders(cached.ct, true),
      });
    }
  } catch (err) {
    console.warn("[asset] cache read failed:", (err as Error).message);
  }

  // 2. Fetch via Bright Data
  let bytes: Uint8Array;
  let upstreamCt: string | null;
  try {
    const fetched = await fetchAssetViaBrightData(target.toString());
    bytes = fetched.bytes;
    upstreamCt = fetched.contentType;
  } catch (err) {
    return new Response(`upstream fetch failed: ${(err as Error).message}`, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let ct = guessContentType(target, upstreamCt);
  let body: Uint8Array = bytes;

  // 3. Optionally rewrite CSS so nested font/url() requests come back to us
  if (rewrite) {
    const text = new TextDecoder("utf-8").decode(bytes);
    const rewritten = rewriteCssBody(text, target, requestOrigin);
    body = new TextEncoder().encode(rewritten);
    ct = "text/css; charset=utf-8";
  }

  // 4. Cache (only smallish blobs; fonts are typically <300KB)
  if (body.byteLength <= MAX_CACHE_BYTES) {
    try {
      const b64 = Buffer.from(body).toString("base64");
      await kv.set(assetKey(target.toString(), rewrite), { ct, b64 } satisfies CachedAsset, {
        ex: ASSET_TTL_SECONDS,
      });
    } catch (err) {
      console.warn("[asset] cache write failed:", (err as Error).message);
    }
  }

  return new Response(body, { status: 200, headers: assetHeaders(ct, false) });
}

function assetHeaders(contentType: string, fromCache: boolean): HeadersInit {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
    "X-Mirror-Asset-Cache": fromCache ? "HIT" : "MISS",
  };
}
