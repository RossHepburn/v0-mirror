"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PracticeContext } from "@/lib/practice-context";
import { Chatbot } from "@/components/chatbot/Chatbot";
import { sanitiseForBabel } from "@/lib/sanitise-tsx";

type Props = {
  jobId: string;
  ctx: PracticeContext;
  tsx: string;
};

const IFRAME_HTML = ({
  tsx,
  practiceContext,
  brand,
}: {
  tsx: string;
  practiceContext: PracticeContext;
  brand: PracticeContext["brand"];
}) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mirror pilot — ${escapeHtml(practiceContext.name)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { --brand-primary: ${brand.primary}; --brand-secondary: ${brand.secondary}; --brand-accent: ${brand.accent}; }
    body { font-family: ${brand.fontFamily ?? "Inter, system-ui, sans-serif"}; }
    .chatbot-slot { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; min-height: 380px; background: white; box-shadow: 0 8px 24px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap: 8px; }
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
  <script>
    window.__PRACTICE__ = ${JSON.stringify(practiceContext).replace(/</g, "\\u003c")};
  </script>
  <script>
    function postSize() {
      // Avoid feedback: temporarily allow body to shrink
      const html = document.documentElement;
      const prevMin = html.style.minHeight;
      html.style.minHeight = '0';
      const h = Math.min(8000, html.scrollHeight);
      html.style.minHeight = prevMin;
      window.parent.postMessage({ type: 'mirror-pilot-size', height: h }, '*');
    }
    window.addEventListener('load', () => {
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
            <br/>(Embedded on the deployed pilot.)
          </div>
        </div>
      );

      ${tsx}

      const ctx = window.__PRACTICE__;
      const root = ReactDOM.createRoot(document.getElementById('root'));
      const chatbot = <ChatbotStub practiceName={ctx.name} />;
      // Try to detect the exported component name. Fallback to PilotPage.
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function SandboxRenderer({ jobId, ctx, tsx }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(900);
  const [chatOpen, setChatOpen] = useState(false);
  const screenshotMode = typeof window !== "undefined" && window.location.search.includes("screenshot=1");

  const html = useMemo(
    () => IFRAME_HTML({ tsx: sanitiseForBabel(tsx), practiceContext: ctx, brand: ctx.brand }),
    [tsx, ctx],
  );

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.data?.type === "mirror-pilot-error") setError(ev.data.message);
      if (ev.data?.type === "mirror-pilot-size" && typeof ev.data.height === "number") {
        setIframeHeight((prev) => {
          const target = Math.min(8000, Math.max(900, ev.data.height + 20));
          // Only grow; never shrink (avoids flicker as Tailwind play hydrates)
          return target > prev ? target : prev;
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white" data-pilot-id={jobId}>
      {!screenshotMode && (
        <div className="fixed top-3 right-3 z-50">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur"
          >
            <span className="h-3 w-3 rounded bg-white/90 text-[9px] font-bold text-black flex items-center justify-center">
              M
            </span>
            Mirror pilot · {ctx.name}
          </a>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-800 font-mono">
          Generated component error — using fallback render. {error}
        </div>
      )}

      <iframe
        ref={iframeRef}
        title={`Mirror pilot for ${ctx.name}`}
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
        className="w-full border-0 block"
        style={{ height: `${iframeHeight}px` }}
      />

      {!screenshotMode && (
        <div className="fixed bottom-3 right-3 z-50 w-[380px] max-w-[92vw]">
          {chatOpen ? (
            <div className="rounded-2xl border bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold border-b bg-gray-50">
                <span>Live chat — {ctx.name}</span>
                <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-black">×</button>
              </div>
              <div className="bg-white">
                <Chatbot practiceContext={ctx} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-2xl"
              style={{ background: ctx.brand.primary }}
            >
              💬 Chat with {ctx.name}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
