// Server-side HTML renderers for the fallback tiers (Claude + template).
// Both produce a complete HTML document that includes the same Mirror
// watermark + widget.js as the proxy path, so the chatbot UX is identical
// across all tiers.

import type { PracticeContext } from "@/lib/practice-context";
import { buildWatermark } from "@/lib/proxy-html";
import { sanitiseForBabel } from "@/lib/sanitise-tsx";

function escHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

function widgetScript(opts: { jobId: string; requestOrigin: string }): string {
  return `<script src="${opts.requestOrigin}/widget.js" data-mirror-job-id="${opts.jobId}" data-mirror-origin="${opts.requestOrigin}" defer></script>`;
}

// ---------- Claude tier: TSX rendered inside a srcdoc iframe ----------

function buildClaudeIframeSrcdoc(opts: {
  tsx: string;
  ctx: PracticeContext;
}): string {
  const safeCtx = JSON.stringify(opts.ctx).replace(/</g, "\\u003c");
  const brand = opts.ctx.brand;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(opts.ctx.name)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  :root { --brand-primary: ${brand.primary}; --brand-secondary: ${brand.secondary}; --brand-accent: ${brand.accent}; }
  body { font-family: ${brand.fontFamily ?? "Inter, system-ui, sans-serif"}; }
  .chatbot-slot { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; min-height: 220px; background: white; box-shadow: 0 8px 24px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap: 8px; }
  .chatbot-slot-header { font-weight: 600; font-size: 14px; color: #111; }
  .chatbot-slot-body { flex: 1; display:flex; align-items:center; justify-content:center; color:#666; font-size: 13px; text-align:center; padding: 16px; }
  .err { font-family: ui-monospace, monospace; padding: 24px; background: #fee; color: #911; border:1px solid #fbb; white-space: pre-wrap; }
</style>
</head>
<body>
<div id="root"></div>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script>window.__PRACTICE__ = ${safeCtx};</script>
<script>
  function postSize() {
    var html = document.documentElement;
    var prevMin = html.style.minHeight;
    html.style.minHeight = '0';
    var h = Math.min(8000, html.scrollHeight);
    html.style.minHeight = prevMin;
    window.parent.postMessage({ type: 'mirror-pilot-size', height: h }, '*');
  }
  window.addEventListener('load', function () {
    setTimeout(postSize, 500);
    setTimeout(postSize, 1500);
    setTimeout(postSize, 3000);
  });
</script>
<script type="text/babel" data-presets="typescript,react">
try {
  const Image = (props) => /*#__PURE__*/ React.createElement('img', { ...props, src: typeof props.src === 'string' ? props.src : '' });
  const ChatbotStub = ({ practiceName }) => (
    <div className="chatbot-slot">
      <div className="chatbot-slot-header">Chat with {practiceName}</div>
      <div className="chatbot-slot-body">
        Live chatbot — answers pricing, hours, dentist availability, and books appointments.
        <br />Use the bubble in the bottom-right corner.
      </div>
    </div>
  );

  ${opts.tsx}

  const ctx = window.__PRACTICE__;
  const root = ReactDOM.createRoot(document.getElementById('root'));
  const chatbot = <ChatbotStub practiceName={ctx.name} />;
  const Comp = (typeof PilotPage !== 'undefined' ? PilotPage
    : (typeof Page !== 'undefined' ? Page
      : (typeof Pilot !== 'undefined' ? Pilot : null)));
  if (!Comp) throw new Error('No PilotPage component found in generated TSX.');
  root.render(<Comp practiceContext={ctx} chatbot={chatbot} />);
} catch (e) {
  document.getElementById('root').innerHTML = '<pre class="err">' + (e && e.stack ? e.stack : String(e)) + '</pre>';
  window.parent.postMessage({ type: 'mirror-pilot-error', message: e && e.message ? e.message : String(e) }, '*');
}
</script>
</body>
</html>`;
}

export function renderClaudeHtml(opts: {
  jobId: string;
  ctx: PracticeContext;
  tsx: string;
  requestOrigin: string;
  generatedOn: string;
}): string {
  const srcdoc = buildClaudeIframeSrcdoc({
    tsx: sanitiseForBabel(opts.tsx),
    ctx: opts.ctx,
  });
  const watermark = buildWatermark({
    practiceName: opts.ctx.name,
    generatedOn: opts.generatedOn,
    tier: "claude",
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mirror pilot — ${escHtml(opts.ctx.name)}</title>
<style>html,body{margin:0;padding:0;background:#fff;height:100%;}#mirror-claude-frame{width:100%;border:0;display:block;min-height:100vh;}</style>
</head>
<body>
<iframe id="mirror-claude-frame" sandbox="allow-scripts allow-same-origin" srcdoc="${escHtml(srcdoc)}"></iframe>
<script>
  (function(){
    var frame = document.getElementById('mirror-claude-frame');
    window.addEventListener('message', function(ev){
      var d = ev.data || {};
      if (d.type === 'mirror-pilot-size' && typeof d.height === 'number') {
        var target = Math.min(8000, Math.max(900, d.height + 20));
        var current = parseInt(frame.style.height || '0', 10) || 0;
        if (target > current) frame.style.height = target + 'px';
      }
    });
  })();
</script>
${watermark}
${widgetScript({ jobId: opts.jobId, requestOrigin: opts.requestOrigin })}
</body>
</html>`;
}

// ---------- Template tier: minimal on-brand fallback ----------

export function renderTemplateHtml(opts: {
  jobId: string;
  ctx: PracticeContext;
  requestOrigin: string;
  generatedOn: string;
}): string {
  const ctx = opts.ctx;
  const brand = ctx.brand;
  const treatments = (ctx.treatments || []).slice(0, 8);
  const practitioners = (ctx.practitioners || []).slice(0, 6);
  const hours = ctx.hours || [];
  const watermark = buildWatermark({
    practiceName: ctx.name,
    generatedOn: opts.generatedOn,
    tier: "template",
  });

  const treatmentCards = treatments
    .map(
      (t) =>
        `<div class="card"><h3>${escHtml(t.name)}</h3>${
          t.description ? `<p>${escHtml(t.description)}</p>` : ""
        }${t.priceFrom ? `<p class="price">From £${escHtml(String(t.priceFrom))}</p>` : ""}</div>`,
    )
    .join("");

  const practitionerCards = practitioners
    .map(
      (p) =>
        `<div class="card"><h3>${escHtml(p.name)}</h3><p class="role">${escHtml(p.role)}</p>${
          p.bio ? `<p>${escHtml(p.bio)}</p>` : ""
        }</div>`,
    )
    .join("");

  const hoursRows = hours
    .map((h) => `<tr><th>${escHtml(h.day)}</th><td>${escHtml(h.hours)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(ctx.name)}</title>
<style>
  :root { --brand: ${brand.primary}; --brand2: ${brand.secondary}; --accent: ${brand.accent}; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${brand.fontFamily ?? "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"}; color: #1a1a1a; background: #fff; line-height: 1.5; }
  .container { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
  header { background: var(--brand); color: #fff; padding: 18px 0; }
  header .container { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  header .name { font-weight: 700; font-size: 18px; letter-spacing: 0.4px; }
  header .phone { font-size: 14px; opacity: 0.92; }
  .hero { background: linear-gradient(160deg, var(--brand), var(--brand2)); color: #fff; padding: 80px 0 96px; text-align: center; }
  .hero h1 { font-size: 44px; margin: 0 0 14px; line-height: 1.1; font-weight: 800; }
  .hero p { max-width: 640px; margin: 0 auto 28px; font-size: 18px; opacity: 0.92; }
  .cta { display: inline-flex; gap: 8px; background: var(--accent); color: var(--brand); font-weight: 700; padding: 12px 24px; border-radius: 999px; text-decoration: none; }
  section { padding: 56px 0; }
  section h2 { font-size: 30px; margin: 0 0 8px; color: var(--brand); }
  section .lead { color: #555; max-width: 720px; margin: 0 0 28px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
  .card { background: #fff; border: 1px solid #ececec; border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .card h3 { margin: 0 0 6px; font-size: 17px; color: #111; }
  .card .role { color: var(--brand); font-weight: 600; font-size: 13px; margin: 0 0 6px; }
  .card .price { color: var(--brand); font-weight: 700; margin: 6px 0 0; }
  .alt { background: #f7f7f8; }
  table.hours { width: 100%; max-width: 420px; border-collapse: collapse; }
  table.hours th, table.hours td { text-align: left; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
  table.hours th { font-weight: 600; color: #333; }
  footer { background: #0f172a; color: #cbd5e1; padding: 32px 0; font-size: 14px; }
  footer a { color: #fff; text-decoration: none; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  @media (max-width: 720px) { .row { grid-template-columns: 1fr; } .hero h1 { font-size: 34px; } }
</style>
</head>
<body>
<header>
  <div class="container">
    <div class="name">${escHtml(ctx.name)}</div>
    <div class="phone"><a href="tel:${escHtml(ctx.phone)}" style="color:#fff;text-decoration:none;">${escHtml(ctx.phone)}</a></div>
  </div>
</header>

<section class="hero">
  <div class="container">
    <h1>${escHtml(ctx.name)}</h1>
    <p>${escHtml(ctx.tagline || "Modern, patient-focused dental care.")}</p>
    <a class="cta" href="tel:${escHtml(ctx.phone)}">Call ${escHtml(ctx.phone)}</a>
  </div>
</section>

${treatments.length > 0 ? `
<section>
  <div class="container">
    <h2>Treatments</h2>
    <p class="lead">A full range of dental care from routine check-ups through to advanced cosmetic treatments.</p>
    <div class="grid">${treatmentCards}</div>
  </div>
</section>` : ""}

${practitioners.length > 0 ? `
<section class="alt">
  <div class="container">
    <h2>Our team</h2>
    <p class="lead">Meet the dentists and specialists looking after your smile.</p>
    <div class="grid">${practitionerCards}</div>
  </div>
</section>` : ""}

<section>
  <div class="container">
    <div class="row">
      <div>
        <h2>Visit us</h2>
        <p class="lead">${escHtml(ctx.address)}</p>
        <p>Phone: <a href="tel:${escHtml(ctx.phone)}" style="color:var(--brand);">${escHtml(ctx.phone)}</a></p>
        ${ctx.email ? `<p>Email: <a href="mailto:${escHtml(ctx.email)}" style="color:var(--brand);">${escHtml(ctx.email)}</a></p>` : ""}
        ${ctx.nhsAccepted ? `<p><strong style="color:var(--brand);">NHS &amp; private patients welcome.</strong></p>` : (ctx.privateOnly ? `<p><strong style="color:var(--brand);">Private practice.</strong></p>` : "")}
      </div>
      <div>
        ${hoursRows ? `<h2>Opening hours</h2><table class="hours">${hoursRows}</table>` : ""}
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="container">
    <div>${escHtml(ctx.name)} · ${escHtml(ctx.address)}</div>
  </div>
</footer>

${watermark}
${widgetScript({ jobId: opts.jobId, requestOrigin: opts.requestOrigin })}
</body>
</html>`;
}
