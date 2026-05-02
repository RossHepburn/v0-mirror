import * as cheerio from "cheerio";
import { Redis } from "@upstash/redis";
import { readJob } from "@/lib/jobs";
import { fetchHtmlViaBrightData } from "@/lib/bright-data";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const PROXIED_TTL_SECONDS = 60 * 60;
const proxiedKey = (id: string) => `job:${id}:proxied-html`;

const SCRIPT_HOST_BLOCKLIST = [
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "doubleclick.net",
  "facebook.net",
  "connect.facebook.net",
  "hotjar.com",
  "mouseflow.com",
  "segment.io",
  "tawk.to",
  "intercomcdn.com",
  "intercom.io",
  "drift.com",
  "tidio.co",
  "tidiochat.com",
  "livechatinc.com",
  "olark.com",
  "zopim.com",
  "zdassets.com",
  "smooch.io",
  "freshchat.com",
  "userlike.com",
];

const ATTR_TARGETS: Array<[string, string]> = [
  ["a", "href"],
  ["link", "href"],
  ["img", "src"],
  ["img", "data-src"],
  ["source", "src"],
  ["script", "src"],
  ["iframe", "src"],
  ["video", "src"],
  ["video", "poster"],
  ["audio", "src"],
  ["form", "action"],
  ["use", "href"],
  ["use", "xlink:href"],
];

function absolutise(value: string | undefined, base: URL): string | undefined {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("javascript:")) {
    return trimmed;
  }
  if (trimmed.startsWith("#")) return trimmed;
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) return trimmed;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return trimmed;
  }
}

function rewriteSrcset(value: string, base: URL): string {
  return value
    .split(",")
    .map((part) => {
      const seg = part.trim();
      if (!seg) return seg;
      const [url, ...rest] = seg.split(/\s+/);
      const abs = absolutise(url, base) || url;
      return [abs, ...rest].join(" ");
    })
    .join(", ");
}

function buildWatermark(name: string): string {
  const safe = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
    <div id="__mirror_watermark" style="
      position: fixed; top: 12px; right: 12px; z-index: 2147483646;
      background: rgba(15, 23, 42, 0.86); color: #fff; backdrop-filter: blur(8px);
      padding: 6px 12px; border-radius: 999px; font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      letter-spacing: 0.4px; text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      pointer-events: none;
    ">
      <span style="opacity: 0.7;">Mirror pilot ·</span> ${safe}
    </div>
  `;
}

export function rewriteHtml(opts: {
  rawHtml: string;
  sourceUrl: string;
  jobId: string;
  practiceName: string;
  requestOrigin: string;
}): string {
  const sourceBase = new URL(opts.sourceUrl);
  const $ = cheerio.load(opts.rawHtml, { decodeEntities: false });

  $('meta[http-equiv="Content-Security-Policy" i]').remove();
  $('meta[http-equiv="content-security-policy" i]').remove();
  $('meta[http-equiv="X-Frame-Options" i]').remove();

  const head = $("head").first();
  if (head.length) {
    head.prepend(`<base href="${sourceBase.toString()}">`);
  }

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    try {
      const u = new URL(src, sourceBase);
      if (SCRIPT_HOST_BLOCKLIST.some((host) => u.host.endsWith(host))) {
        $(el).remove();
        return;
      }
    } catch {
      /* ignore */
    }
  });

  $("noscript").remove();

  for (const [tag, attr] of ATTR_TARGETS) {
    $(`${tag}[${attr.replace(/:/g, "\\:")}]`).each((_, el) => {
      const val = $(el).attr(attr);
      if (!val) return;
      $(el).attr(attr, absolutise(val, sourceBase) || val);
    });
  }

  $("img[srcset], source[srcset]").each((_, el) => {
    const val = $(el).attr("srcset");
    if (!val) return;
    $(el).attr("srcset", rewriteSrcset(val, sourceBase));
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    if (!style.includes("url(")) return;
    const next = style.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (_m, q, ref) => {
      const abs = absolutise(ref, sourceBase) || ref;
      return `url(${q}${abs}${q})`;
    });
    $(el).attr("style", next);
  });

  $("style").each((_, el) => {
    const css = $(el).html() || "";
    if (!css.includes("url(")) return;
    const next = css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (_m, q, ref) => {
      if (ref.startsWith("data:")) return `url(${q}${ref}${q})`;
      const abs = absolutise(ref, sourceBase) || ref;
      return `url(${q}${abs}${q})`;
    });
    $(el).html(next);
  });

  const body = $("body").first();
  if (body.length) {
    body.append(buildWatermark(opts.practiceName));
    body.append(
      `<script src="${opts.requestOrigin}/widget.js" data-mirror-job-id="${opts.jobId}" data-mirror-origin="${opts.requestOrigin}" defer></script>`,
    );
  }

  return $.html();
}

export function htmlResponseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, max-age=60",
    "Content-Security-Policy":
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; style-src * data: blob: 'unsafe-inline'; img-src * data: blob:; font-src * data:; connect-src * data: blob:; frame-src *; frame-ancestors 'self';",
    "X-Frame-Options": "SAMEORIGIN",
  };
}

export async function getProxiedHtml(opts: {
  jobId: string;
  requestOrigin: string;
  force?: boolean;
}): Promise<{ status: number; body: string; headers: HeadersInit }> {
  if (!opts.force) {
    try {
      const cached = await kv.get<string>(proxiedKey(opts.jobId));
      if (cached) {
        return { status: 200, body: cached, headers: htmlResponseHeaders() };
      }
    } catch (err) {
      console.error("[proxy] cache read failed:", err);
    }
  }

  const job = await readJob(opts.jobId);
  if (!job) {
    return {
      status: 404,
      body: "Job not found",
      headers: { "Content-Type": "text/plain" },
    };
  }
  if (!job.url) {
    return {
      status: 400,
      body: "Job has no source URL",
      headers: { "Content-Type": "text/plain" },
    };
  }

  let raw: string;
  try {
    raw = await fetchHtmlViaBrightData(job.url);
  } catch (err) {
    return {
      status: 502,
      body: `Bright Data fetch failed: ${(err as Error).message}`,
      headers: { "Content-Type": "text/plain" },
    };
  }

  const practiceName = job.practiceContext?.name || job.profile?.practiceName || "Practice";
  const rewritten = rewriteHtml({
    rawHtml: raw,
    sourceUrl: job.url,
    jobId: opts.jobId,
    practiceName,
    requestOrigin: opts.requestOrigin,
  });

  try {
    await kv.set(proxiedKey(opts.jobId), rewritten, { ex: PROXIED_TTL_SECONDS });
  } catch (err) {
    console.error("[proxy] cache write failed:", err);
  }

  return { status: 200, body: rewritten, headers: htmlResponseHeaders() };
}
