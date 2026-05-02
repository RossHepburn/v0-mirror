import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { Redis } from "@upstash/redis";
import { readJob, updateJob } from "@/lib/jobs";
import type { RendererTier } from "@/lib/jobs";
import { fetchHtmlViaBrightData } from "@/lib/bright-data";
import { readComponent } from "@/lib/compose";
import { renderClaudeHtml, renderTemplateHtml } from "@/lib/render-fallbacks";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const PROXIED_TTL_SECONDS = 60 * 60;
const RENDERED_TTL_SECONDS = 60 * 60;

export function normalisePath(rawPath: string | null | undefined): string {
  if (!rawPath) return "/";
  let p = rawPath.trim();
  if (!p) return "/";
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

function pathHash(path: string): string {
  return createHash("sha1").update(path).digest("hex").slice(0, 8);
}

const proxiedKey = (id: string, hash: string) => `job:${id}:proxied-html:${hash}`;
const renderedKey = (id: string, tier: RendererTier, hash: string) =>
  `job:${id}:rendered-${tier}:${hash}`;

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
  // Consent Management Platforms — strip so cookie banners don't obscure the page
  "cookielaw.org",
  "cookiebot.com",
  "onetrust.com",
  "quantcast.com",
  "trustarc.com",
  "cmp.osano.com",
  "osano.com",
  "hs-scripts.com",
  "sourcepoint.com",
  "consent.cookiebot.com",
  "consent.cookiefirst.com",
  "cookieyes.com",
];

// Inline analytics SDK markers — substring match (case-insensitive) against
// script innerHTML for <script> tags WITHOUT a src attribute. Aggressive on
// purpose: false positives matter less than false negatives here.
const INLINE_ANALYTICS_MARKERS = [
  "datalayer",
  "gtag(",
  "gtag('",
  "_gaq",
  "ga('",
  "fbq(",
  "hj(",
  "clarity(",
  "_paq",
  "window.datalayer",
  "googletagmanager",
  "google-analytics",
  "hotjar",
  "clarity",
  "mixpanel",
  "amplitude",
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

const FONT_EXT_RE = /\.(woff2|woff|ttf|otf|eot)(\?|#|$)/i;

function isFontUrl(u: string): boolean {
  return FONT_EXT_RE.test(u);
}

function proxiedAssetUrl(absoluteUrl: string, requestOrigin: string, rewriteCss = false): string {
  const base = `${requestOrigin}/api/asset?u=${encodeURIComponent(absoluteUrl)}`;
  return rewriteCss ? `${base}&rewrite=css` : base;
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

function escAttr(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

const TIER_LABELS: Record<RendererTier, { label: string; colour: string }> = {
  proxy: { label: "Full mirror", colour: "#10b981" },
  claude: { label: "Brand-matched recreation", colour: "#f59e0b" },
  template: { label: "Generic template", colour: "#ef4444" },
};

export function buildWatermark(opts: {
  practiceName: string;
  generatedOn: string; // human-readable
  tier?: RendererTier;
}): string {
  const name = escAttr(opts.practiceName);
  const generatedOn = escAttr(opts.generatedOn);
  const tier = opts.tier;
  const tierMeta = tier ? TIER_LABELS[tier] : null;
  const tierBadge = tierMeta
    ? `<span style="display:inline-flex;align-items:center;gap:4px;background:${tierMeta.colour};color:#fff;border-radius:999px;padding:1px 8px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">${escAttr(tierMeta.label)}</span>`
    : "";

  // Self-contained inline watermark + click-popover. Inline style attrs
  // beat page stylesheets, max z-index keeps it on top, and a tiny IIFE
  // wires the toggle + outside-click close.
  return `
    <div id="__mirror_watermark_root" style="position: fixed; left: 16px; bottom: 16px; z-index: 2147483646; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;">
      <button id="__mirror_watermark_btn" type="button" aria-label="About this Mirror pilot" style="
        all: unset; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(0,0,0,0.7); color: #fff; backdrop-filter: blur(8px);
        padding: 4px 10px; border-radius: 999px;
        font-size: 10px; font-weight: 500; letter-spacing: 0.3px; text-transform: uppercase;
        box-shadow: 0 4px 12px rgba(0,0,0,0.18);
        font-family: inherit; line-height: 1.5;
      ">
        <span style="display:inline-block; width: 5px; height: 5px; border-radius: 50%; background: #34d399;"></span>
        <span>Mirror pilot</span>
        <span style="opacity: 0.6;">·</span>
        <span>${name}</span>
        <span style="margin-left:4px; opacity: 0.85; font-size: 11px; line-height: 1;">ⓘ</span>
      </button>
      <div id="__mirror_watermark_popover" role="dialog" aria-labelledby="__mirror_wm_title" style="
        display: none; position: absolute; left: 0; bottom: 38px; width: 290px;
        background: #fff; color: #0f172a; border: 1px solid #e2e8f0;
        border-radius: 12px; padding: 14px 16px; box-shadow: 0 24px 48px rgba(0,0,0,0.18);
        font-size: 13px; line-height: 1.5; text-align: left; text-transform: none; letter-spacing: 0;
      ">
        <div id="__mirror_wm_title" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <strong style="font-size:13px;color:#0f172a;">Mirror pilot</strong>
          ${tierBadge}
        </div>
        <div style="color:#475569;">
          This is a Mirror pilot — <strong style="color:#0f172a;">${name}</strong>'s
          site with our AI chatbot embedded.
        </div>
        <div style="margin-top:6px;color:#94a3b8;font-size:11px;">Generated on ${generatedOn}.</div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
          Internal sales preview · not affiliated with the practice.
        </div>
      </div>
    </div>
    <script>(function(){
      var btn = document.getElementById('__mirror_watermark_btn');
      var pop = document.getElementById('__mirror_watermark_popover');
      var root = document.getElementById('__mirror_watermark_root');
      if (!btn || !pop || !root) return;
      function open(){ pop.style.display='block'; }
      function close(){ pop.style.display='none'; }
      function toggle(){ pop.style.display === 'block' ? close() : open(); }
      btn.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
      pop.addEventListener('click', function(e){ e.stopPropagation(); });
      document.addEventListener('click', function(e){ if (!root.contains(e.target)) close(); });
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
    })();</script>
  `;
}

export function formatGeneratedOn(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function rewriteHtml(opts: {
  rawHtml: string;
  sourceUrl: string;
  jobId: string;
  practiceName: string;
  requestOrigin: string;
  generatedOn: string;
  rendererTier?: RendererTier;
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

  $("script:not([src])").each((_, el) => {
    const text = ($(el).html() || "").toLowerCase();
    if (!text) return;
    if (INLINE_ANALYTICS_MARKERS.some((m) => text.includes(m))) {
      $(el).remove();
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

  const sourceOrigin = sourceBase.origin;
  const pilotBase = `/p/${opts.jobId}`;

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href) return;
    if (href.startsWith("#")) return;
    if (/^(mailto|tel|sms):/i.test(href)) return;
    if (/^javascript:/i.test(href)) {
      $(el).removeAttr("href");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(href, sourceBase);
    } catch {
      return;
    }
    if (parsed.origin === sourceOrigin) {
      const innerPath = parsed.pathname + parsed.search + parsed.hash;
      $(el).attr("href", `${pilotBase}?path=${encodeURIComponent(innerPath)}`);
      // Internal nav stays in the pilot tab — strip target=_blank if set.
      const target = ($(el).attr("target") || "").toLowerCase();
      if (target === "_blank") $(el).removeAttr("target");
    } else {
      if (!$(el).attr("target")) $(el).attr("target", "_blank");
      const rel = ($(el).attr("rel") || "").toLowerCase();
      const relSet = new Set(rel.split(/\s+/).filter(Boolean));
      relSet.add("noopener");
      relSet.add("noreferrer");
      $(el).attr("rel", Array.from(relSet).join(" "));
    }
  });

  // TODO(internal-nav): proxy form submissions server-side. For now we only
  // rewrite the action URL so GET forms (search etc.) stay in-pilot — POSTs
  // will hit /p/[id] which is GET-only and 405. Acceptable for the demo:
  // most prospect contact forms are out-of-scope until a real prospect tries
  // to use one through the pilot.
  $("form[action]").each((_, el) => {
    const action = ($(el).attr("action") || "").trim();
    if (!action) return;
    if (/^(mailto|javascript):/i.test(action)) return;
    let parsed: URL;
    try {
      parsed = new URL(action, sourceBase);
    } catch {
      return;
    }
    if (parsed.origin === sourceOrigin) {
      const innerPath = parsed.pathname + parsed.search;
      $(el).attr("action", `${pilotBase}?path=${encodeURIComponent(innerPath)}`);
    }
  });

  // Route external CSS through the asset proxy with CSS rewriting on, so
  // any @font-face url(...) inside is also proxied (avoiding cross-origin
  // font CORS rejections).
  $('link[rel~="stylesheet" i][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, sourceBase).toString();
      $(el).attr("href", proxiedAssetUrl(abs, opts.requestOrigin, true));
      // crossorigin attribute interferes with us serving from same-origin
      $(el).removeAttr("crossorigin");
      $(el).removeAttr("integrity");
    } catch {
      /* ignore */
    }
  });

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
      // Fonts must be served same-origin to satisfy CORS.
      if (isFontUrl(abs)) {
        return `url(${q}${proxiedAssetUrl(abs, opts.requestOrigin)}${q})`;
      }
      return `url(${q}${abs}${q})`;
    });
    $(el).html(next);
  });

  const body = $("body").first();
  if (body.length) {
    body.append(
      buildWatermark({
        practiceName: opts.practiceName,
        generatedOn: opts.generatedOn,
        tier: opts.rendererTier ?? "proxy",
      }),
    );
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

// ----- Viability assessment -----

export type ProxyAssessment =
  | { status: "ok"; rawHtml: string; htmlLength: number; bodyTextLength: number; scriptCount: number }
  | { status: "sparse"; rawHtml: string; htmlLength: number; bodyTextLength: number; scriptCount: number; reason: string }
  | { status: "blocked"; reason: string };

const SPARSE_BODY_TEXT_THRESHOLD = 500;
const SPA_SCRIPT_THRESHOLD = 5;

export function inspectProxyHtml(rawHtml: string): {
  htmlLength: number;
  bodyTextLength: number;
  scriptCount: number;
} {
  const $ = cheerio.load(rawHtml);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const scriptCount = $("script[src]").length;
  return {
    htmlLength: rawHtml.length,
    bodyTextLength: bodyText.length,
    scriptCount,
  };
}

export async function assessProxyViability(url: string): Promise<ProxyAssessment> {
  let rawHtml: string;
  try {
    rawHtml = await fetchHtmlViaBrightData(url);
  } catch (err) {
    return { status: "blocked", reason: `Bright Data fetch failed: ${(err as Error).message}` };
  }
  const { htmlLength, bodyTextLength, scriptCount } = inspectProxyHtml(rawHtml);
  if (bodyTextLength < SPARSE_BODY_TEXT_THRESHOLD && scriptCount > SPA_SCRIPT_THRESHOLD) {
    return {
      status: "sparse",
      rawHtml,
      htmlLength,
      bodyTextLength,
      scriptCount,
      reason: `body text ${bodyTextLength} chars, ${scriptCount} script[src] tags — likely SPA`,
    };
  }
  return { status: "ok", rawHtml, htmlLength, bodyTextLength, scriptCount };
}

// ----- Renderers per tier -----

async function renderProxyTier(opts: {
  jobId: string;
  requestOrigin: string;
  rawHtml: string;
  path: string;
  cacheWrite: boolean;
}): Promise<string> {
  const job = await readJob(opts.jobId);
  if (!job) throw new Error("Job vanished while rendering proxy tier");
  const practiceName = job.practiceContext?.name || job.profile?.practiceName || "Practice";
  const fullSourceUrl = new URL(opts.path, job.url).toString();
  const rewritten = rewriteHtml({
    rawHtml: opts.rawHtml,
    sourceUrl: fullSourceUrl,
    jobId: opts.jobId,
    practiceName,
    requestOrigin: opts.requestOrigin,
    generatedOn: formatGeneratedOn(job.createdAt),
    rendererTier: "proxy",
  });
  if (opts.cacheWrite) {
    try {
      await kv.set(proxiedKey(opts.jobId, pathHash(opts.path)), rewritten, {
        ex: PROXIED_TTL_SECONDS,
      });
    } catch (err) {
      console.error("[proxy] cache write failed:", err);
    }
  }
  return rewritten;
}

// ----- Proxy-only path (used by /api/proxy/[id] and the proxy tier of /p/[id]) -----

export async function getProxiedHtml(opts: {
  jobId: string;
  requestOrigin: string;
  path?: string;
  force?: boolean;
}): Promise<{ status: number; body: string; headers: HeadersInit }> {
  const path = normalisePath(opts.path);
  const hash = pathHash(path);

  if (!opts.force) {
    try {
      const cached = await kv.get<string>(proxiedKey(opts.jobId, hash));
      if (cached) {
        return { status: 200, body: cached, headers: htmlResponseHeaders() };
      }
    } catch (err) {
      console.error("[proxy] cache read failed:", err);
    }
  }

  const job = await readJob(opts.jobId);
  if (!job) {
    return { status: 404, body: "Job not found", headers: { "Content-Type": "text/plain" } };
  }
  if (!job.url) {
    return { status: 400, body: "Job has no source URL", headers: { "Content-Type": "text/plain" } };
  }

  const fullUrl = new URL(path, job.url).toString();
  let raw: string;
  try {
    raw = await fetchHtmlViaBrightData(fullUrl);
  } catch (err) {
    return {
      status: 502,
      body: `Bright Data fetch failed: ${(err as Error).message}`,
      headers: { "Content-Type": "text/plain" },
    };
  }

  const body = await renderProxyTier({
    jobId: opts.jobId,
    requestOrigin: opts.requestOrigin,
    rawHtml: raw,
    path,
    cacheWrite: true,
  });
  return { status: 200, body, headers: htmlResponseHeaders() };
}

// ----- Fallback chain dispatcher (used by /p/[id]) -----

export async function getRenderedPilot(opts: {
  jobId: string;
  requestOrigin: string;
  path?: string;
  force?: boolean;
}): Promise<{ status: number; body: string; headers: HeadersInit; tier?: RendererTier }> {
  const path = normalisePath(opts.path);
  const isHomepage = path === "/";
  const hash = pathHash(path);

  const job = await readJob(opts.jobId);
  if (!job) {
    return { status: 404, body: "Job not found", headers: { "Content-Type": "text/plain" } };
  }
  if (!job.url) {
    return { status: 400, body: "Job has no source URL", headers: { "Content-Type": "text/plain" } };
  }
  if (!job.practiceContext) {
    return {
      status: 425,
      body: "Pilot not ready yet (analysis incomplete)",
      headers: { "Content-Type": "text/plain" },
    };
  }

  // 1. Use cached decision when present
  const cachedTier = !opts.force ? job.renderer?.tier : undefined;
  if (cachedTier) {
    const cached = await kv
      .get<string>(renderedKey(opts.jobId, cachedTier, hash))
      .catch(() => null);
    if (cached) {
      return { status: 200, body: cached, headers: htmlResponseHeaders(), tier: cachedTier };
    }
    // Internal pages only make sense for the proxy tier — Claude/template
    // are single-page renders. Fall back to the homepage render for nav
    // clicks under those tiers.
    if (cachedTier !== "proxy" && !isHomepage) {
      const homeHash = pathHash("/");
      const home = await kv
        .get<string>(renderedKey(opts.jobId, cachedTier, homeHash))
        .catch(() => null);
      if (home) {
        return { status: 200, body: home, headers: htmlResponseHeaders(), tier: cachedTier };
      }
    }
  }

  // 2. Try proxy tier (single BD call). On ok → render proxy.
  const fullUrl = new URL(path, job.url).toString();
  const assessment = await assessProxyViability(fullUrl);

  let chosenTier: RendererTier;
  let reason: string;
  let html: string;

  if (assessment.status === "ok") {
    chosenTier = "proxy";
    reason = `body ${assessment.bodyTextLength} chars, ${assessment.scriptCount} scripts`;
    html = await renderProxyTier({
      jobId: opts.jobId,
      requestOrigin: opts.requestOrigin,
      rawHtml: assessment.rawHtml,
      path,
      cacheWrite: true,
    });
  } else {
    // Fall back to claude if a generated component exists
    const tsx = await readComponent(opts.jobId).catch(() => null);
    if (tsx) {
      chosenTier = "claude";
      reason = `${assessment.reason} → using Claude`;
      html = renderClaudeHtml({
        jobId: opts.jobId,
        ctx: job.practiceContext,
        tsx,
        requestOrigin: opts.requestOrigin,
        generatedOn: formatGeneratedOn(job.createdAt),
      });
    } else {
      chosenTier = "template";
      reason = `${assessment.reason} → no Claude component → using template`;
      html = renderTemplateHtml({
        jobId: opts.jobId,
        ctx: job.practiceContext,
        requestOrigin: opts.requestOrigin,
        generatedOn: formatGeneratedOn(job.createdAt),
      });
    }
  }

  // 3. Persist tier (only on the homepage — internal-nav assessments are
  // per-path noise) + cache rendered HTML keyed by path.
  if (isHomepage) {
    const persistedAssessment =
      assessment.status === "blocked"
        ? { htmlLength: undefined, bodyTextLength: undefined }
        : { htmlLength: assessment.htmlLength, bodyTextLength: assessment.bodyTextLength };

    try {
      await updateJob(opts.jobId, (j) => {
        j.renderer = {
          tier: chosenTier,
          reason,
          htmlLength: persistedAssessment.htmlLength,
          bodyTextLength: persistedAssessment.bodyTextLength,
          decidedAt: new Date().toISOString(),
        };
      });
    } catch (err) {
      console.error("[pilot] failed to persist renderer info:", err);
    }
  }
  try {
    await kv.set(renderedKey(opts.jobId, chosenTier, hash), html, {
      ex: RENDERED_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[pilot] rendered cache write failed:", err);
  }

  return { status: 200, body: html, headers: htmlResponseHeaders(), tier: chosenTier };
}
