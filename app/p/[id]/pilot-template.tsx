"use client";

import { Chatbot } from "@/components/chatbot/Chatbot";
import type { PracticeContext } from "@/lib/practice-context";

export function PilotTemplate({ jobId, ctx }: { jobId: string; ctx: PracticeContext }) {
  const themeStyle = {
    "--brand-primary": ctx.brand.primary,
    "--brand-secondary": ctx.brand.secondary,
    "--brand-accent": ctx.brand.accent,
    fontFamily: ctx.brand.fontFamily ?? "Inter, system-ui, sans-serif",
    color: "#1a1a1a",
  } as React.CSSProperties;

  const featuredTreatments = ctx.treatments.slice(0, 6);

  return (
    <div style={themeStyle} className="min-h-screen" data-pilot-id={jobId}>
      {/* Mirror watermark — small, top-right, so the demo audience sees this is the pilot */}
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

      {/* Header */}
      <header
        className="px-6 py-5"
        style={{ background: ctx.brand.primary, color: "white" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="text-lg font-semibold">{ctx.name}</div>
            {ctx.tagline && (
              <div className="text-sm opacity-80">{ctx.tagline}</div>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-5 text-sm opacity-90">
            <a href="#treatments">Treatments</a>
            <a href="#team">Team</a>
            <a href="#contact">Contact</a>
            <a href="#chat" className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">
              Chat with us
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="px-6 py-14"
        style={{ background: ctx.brand.secondary }}
      >
        <div className="mx-auto max-w-5xl grid gap-8 md:grid-cols-2 items-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
              {ctx.tagline || `Modern dentistry at ${ctx.name}.`}
            </h1>
            <p className="text-base opacity-80">
              {ctx.privateOnly
                ? "A private dental practice offering exceptional, unhurried care."
                : ctx.nhsAccepted
                  ? "We see both NHS and private patients across our full range of treatments."
                  : "Get in touch to discuss your treatment options."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#chat"
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: ctx.brand.primary }}
              >
                Ask our assistant
              </a>
              {ctx.phone && (
                <a
                  href={`tel:${ctx.phone}`}
                  className="rounded-full border px-5 py-2.5 text-sm font-semibold"
                  style={{ borderColor: ctx.brand.primary, color: ctx.brand.primary }}
                >
                  Call {ctx.phone}
                </a>
              )}
            </div>
          </div>
          <div
            className="rounded-2xl p-6 shadow-md"
            style={{ background: "white", borderTop: `4px solid ${ctx.brand.accent}` }}
          >
            <div className="text-xs uppercase tracking-wide" style={{ color: ctx.brand.primary }}>
              Visit us
            </div>
            <div className="mt-2 text-base font-semibold">{ctx.address || "Address coming soon"}</div>
            {ctx.email && <div className="text-sm opacity-70 mt-1">{ctx.email}</div>}
            <div className="mt-4 text-xs uppercase tracking-wide" style={{ color: ctx.brand.primary }}>
              Opening hours
            </div>
            <ul className="mt-2 text-sm space-y-1">
              {ctx.hours.slice(0, 5).map((h) => (
                <li key={h.day} className="flex justify-between gap-3">
                  <span className="opacity-70">{h.day}</span>
                  <span>{h.hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Treatments */}
      {featuredTreatments.length > 0 && (
        <section id="treatments" className="px-6 py-12 bg-white">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 text-xs uppercase tracking-wide" style={{ color: ctx.brand.primary }}>
              Treatments
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredTreatments.map((t) => (
                <div
                  key={t.name}
                  className="rounded-xl border p-4"
                  style={{ borderColor: `${ctx.brand.primary}22` }}
                >
                  <div className="text-base font-semibold">{t.name}</div>
                  {(t.priceFrom || t.priceTo) && (
                    <div className="text-sm" style={{ color: ctx.brand.primary }}>
                      {t.priceTo
                        ? `£${t.priceFrom}–£${t.priceTo}`
                        : t.priceFrom
                          ? `from £${t.priceFrom}`
                          : ""}
                    </div>
                  )}
                  {t.description && (
                    <p className="mt-2 text-sm opacity-80">{t.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Team */}
      {ctx.practitioners.length > 0 && (
        <section
          id="team"
          className="px-6 py-12"
          style={{ background: ctx.brand.secondary }}
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 text-xs uppercase tracking-wide" style={{ color: ctx.brand.primary }}>
              Meet the team
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ctx.practitioners.slice(0, 6).map((p) => (
                <div
                  key={p.name}
                  className="rounded-xl bg-white p-4 shadow-sm"
                  style={{ borderTop: `3px solid ${ctx.brand.accent}` }}
                >
                  <div className="text-base font-semibold">{p.name}</div>
                  <div className="text-sm" style={{ color: ctx.brand.primary }}>
                    {p.role}
                  </div>
                  {p.bio && <p className="mt-2 text-sm opacity-80">{p.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chat */}
      <section id="chat" className="px-6 py-14 bg-white">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: ctx.brand.primary }}>
              Chat with our team
            </div>
            <h2 className="mt-1 text-2xl font-semibold">
              Ask {ctx.name} anything
            </h2>
            <p className="text-sm opacity-70 mt-1">
              Pricing, opening hours, the right dentist for your treatment, or to book an
              appointment — our assistant has the answers.
            </p>
          </div>
          <div className="flex justify-center">
            <Chatbot practiceContext={ctx} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="contact"
        className="px-6 py-8 text-sm"
        style={{ background: ctx.brand.primary, color: "white" }}
      >
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="font-semibold">{ctx.name}</div>
            {ctx.address && <div className="opacity-80">{ctx.address}</div>}
          </div>
          <div className="opacity-80">
            {ctx.phone && <span>{ctx.phone} · </span>}
            {ctx.email && <span>{ctx.email}</span>}
          </div>
        </div>
        <div className="mx-auto max-w-5xl mt-3 text-xs opacity-60">
          Pilot site generated by Mirror — not the live website.
        </div>
      </footer>
    </div>
  );
}
