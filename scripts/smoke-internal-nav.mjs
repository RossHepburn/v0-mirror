#!/usr/bin/env node
// Smoke test for internal navigation in the proxied pilot.
// Creates 8 jobs in parallel, waits for analyse=complete, then for each:
//   - GET /p/{id} (homepage)
//   - extract first 3 internal pilot links
//   - GET each, verify watermark + tier=proxy + no external escapes
//   - check inline analytics scripts gone
import { readFile, writeFile, mkdir } from "node:fs/promises";

const SITES = [
  ["bakerstreetdental.com",        "https://www.bakerstreetdental.com/"],
  ["confidental.co.uk",            "https://www.confidental.co.uk/"],
  ["dawoodandtanner.co.uk",        "https://www.dawoodandtanner.co.uk/"],
  ["mydentist.co.uk",              "https://www.mydentist.co.uk/"],
  ["bupa.co.uk/dental",            "https://www.bupa.co.uk/dental"],
  ["boutiquedentists.com",         "https://www.boutiquedentists.com/"],
  ["thedentalstudios.co.uk",       "https://www.thedentalstudios.co.uk/"],
  ["dawoodandtanner.co.uk/aboutus","https://www.dawoodandtanner.co.uk/aboutus"],
];

const HOST = "http://localhost:3032";

const ANALYTICS_RE = /<script(?![^>]*\bsrc=)[^>]*>[^<]*\b(dataLayer|gtag\(|fbq\(|_gaq|hotjar|google-analytics|googletagmanager|mixpanel|amplitude|clarity\()/i;

async function jget(path) {
  const r = await fetch(HOST + path, { signal: AbortSignal.timeout(60_000) });
  return { status: r.status, text: await r.text(), headers: r.headers };
}
async function jpost(path, body) {
  const r = await fetch(HOST + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return await r.json();
}

async function waitForAnalyse(id, deadlineMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    const r = await fetch(`${HOST}/api/jobs/${id}/status`).then((r) => r.json());
    const analyse = r.steps?.find((s) => s.key === "analyse");
    if (analyse?.status === "complete") return true;
    if (analyse?.status === "error") return false;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return false;
}

function extractInternalLinks(html, jobId, n = 3) {
  const re = new RegExp(`href="(/p/${jobId}\\?path=[^"]+)"`, "g");
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html)) && out.length < n) {
    const url = m[1];
    // skip the bare /p/{id}?path=%2F homepage link
    if (/path=%2F"/.test(`href="${url}"`)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function externalEscapes(html) {
  // <a href="https://other..."> WITHOUT target="_blank"
  const matches = html.match(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/gi) || [];
  return matches.filter((tag) => !/target="_blank"/i.test(tag));
}

const results = [];

async function runSite([label, url]) {
  const row = { label, url, jobId: null, tier: null, homePages: [], details: [] };
  try {
    const job = await jpost("/api/jobs/create", { url });
    row.jobId = job.id;
    const ok = await waitForAnalyse(job.id);
    if (!ok) {
      row.error = "analyse did not complete in 120s";
      return row;
    }
    // Fetch homepage
    const h = await jget(`/p/${job.id}`);
    row.tier = h.headers.get("x-mirror-renderer");
    row.homeStatus = h.status;
    row.homeBytes = h.text.length;
    row.homeWatermark = (h.text.match(/Mirror pilot/g) || []).length > 0;
    row.homeAnalyticsLeak = ANALYTICS_RE.test(h.text);
    row.homeExternalEscapes = externalEscapes(h.text).length;

    if (row.tier !== "proxy") {
      row.note = `tier=${row.tier} — no internal nav to test`;
      return row;
    }

    // Pick 3 internal links to test
    const links = extractInternalLinks(h.text, job.id, 3);
    row.linksFound = links.length;
    for (const link of links) {
      const r = await jget(link);
      const innerWm = (r.text.match(/Mirror pilot/g) || []).length > 0;
      const innerTier = r.headers.get("x-mirror-renderer");
      const innerEscapes = externalEscapes(r.text).length;
      const innerAnalytics = ANALYTICS_RE.test(r.text);
      row.details.push({
        link,
        status: r.status,
        bytes: r.text.length,
        watermark: innerWm,
        tier: innerTier,
        escapes: innerEscapes,
        analyticsLeak: innerAnalytics,
      });
    }
  } catch (err) {
    row.error = err.message;
  }
  return row;
}

// Run sequentially with a small gap to be gentle on the AI Gateway rate
// limit (free credits are aggressively throttled).
const all = [];
for (const site of SITES) {
  console.log(`-> starting ${site[0]} at ${new Date().toISOString()}`);
  const r = await runSite(site);
  console.log(`   tier=${r.tier} home=${r.homeStatus} inner=${r.details.length}`);
  all.push(r);
  await new Promise((r) => setTimeout(r, 2000));
}

await mkdir("/tmp/internal-nav-smoke", { recursive: true });
await writeFile(
  "/tmp/internal-nav-smoke/results.json",
  JSON.stringify(all, null, 2),
);

console.log("\n=== Summary ===");
for (const r of all) {
  const detailsOk = r.details.filter(
    (d) => d.status === 200 && d.watermark && d.tier === "proxy" && d.escapes === 0 && !d.analyticsLeak,
  ).length;
  console.log(
    `${r.label.padEnd(38)} tier=${(r.tier || "-").padEnd(8)} home=${r.homeStatus} wm=${r.homeWatermark} esc=${r.homeExternalEscapes} ana=${r.homeAnalyticsLeak} | inner ${detailsOk}/${r.details.length} ok${r.error ? "  ERROR: " + r.error : ""}`,
  );
}
