"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Loader2, Clock, FileText, Globe, ArrowLeft, MessageSquare, AlertTriangle, Copy, ExternalLink } from "lucide-react"

type ApiStep = {
  key: "analyse" | "competitors" | "compose" | "pilot"
  name: string
  estimate: string
  status: "pending" | "in-progress" | "complete" | "error"
  error?: string
}

type RendererTier = "proxy" | "claude" | "template"
type RendererInfo = {
  tier: RendererTier
  reason: string
  decidedAt?: string
} | null

type StatusResponse = {
  id: string
  url: string
  steps: ApiStep[]
  pilotPath: string | null
  practiceContext: { slug: string; name: string } | null
  renderer: RendererInfo
  componentBytes: number | null
  allComplete: boolean
  error: string | null
}

const sampleQuestions = [
  "What treatments do you offer?",
  "Do you accept NHS patients?",
  "What are your opening hours?",
  "How do I book an appointment?",
  "Who can do my Invisalign?",
]

export default function JobStatusPage() {
  const params = useParams()
  const jobId = params.id as string
  const [data, setData] = useState<StatusResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const body = (await res.json()) as StatusResponse
        if (cancelled) return
        setData(body)
        setFetchError(null)
        if (!body.allComplete && !body.error) {
          timer = setTimeout(tick, 1500)
        }
      } catch (err) {
        if (cancelled) return
        setFetchError(err instanceof Error ? err.message : "Failed to fetch status")
        timer = setTimeout(tick, 3000)
      }
    }
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId])

  const steps = data?.steps ?? []
  const analyseDone = steps.find((s) => s.key === "analyse")?.status === "complete"
  const cardReady = steps.find((s) => s.key === "competitors")?.status === "complete"
  const pilotReady = steps.find((s) => s.key === "pilot")?.status === "complete"
  const renderer = data?.renderer ?? null
  const pilotUrl =
    typeof window !== "undefined" && data?.pilotPath
      ? `${window.location.origin}${data.pilotPath}`
      : data?.pilotPath ?? ""

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">M</span>
              </div>
              <span className="text-sm font-medium text-foreground">Mirror</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">
              {data?.practiceContext?.name ?? "Building Mirror"}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              Job: {jobId.slice(0, 8)}…
              {data?.url && <> · <span className="font-sans">{data.url}</span></>}
            </p>
            {fetchError && (
              <p className="text-xs text-amber-500">Reconnecting… ({fetchError})</p>
            )}
            {data?.error && (
              <p className="text-xs text-red-500">Job failed: {data.error}</p>
            )}
          </div>

          <div className="space-y-3">
            {steps.length === 0 && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
            {steps.map((step, index) => (
              <div
                key={step.key}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex-shrink-0">
                  {step.status === "pending" && (
                    <div className="h-8 w-8 rounded-full border-2 border-border flex items-center justify-center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {step.status === "in-progress" && (
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    </div>
                  )}
                  {step.status === "complete" && (
                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-emerald-400" />
                    </div>
                  )}
                  {step.status === "error" && (
                    <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {step.error ? step.error : step.estimate}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    Step {index + 1}/{steps.length}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ResultCard
              ready={cardReady}
              href={`/jobs/${jobId}/deck`}
              icon={<FileText className="h-5 w-5" />}
              title="Sales Battle Card"
              waiting="Waiting for analysis to complete…"
              ready_text="Briefing deck ready for your meeting"
            />
            <ResultCard
              ready={pilotReady}
              href={data?.pilotPath || `/jobs/${jobId}/pilot`}
              icon={<Globe className="h-5 w-5" />}
              title="Pilot Site"
              waiting={
                analyseDone
                  ? "Building branded pilot site…"
                  : "Waiting for prospect analysis…"
              }
              ready_text="Branded preview site with embedded chatbot"
              external
            />
          </div>

          {pilotReady && data?.pilotPath && (
            <PilotReadyCard
              practiceName={data.practiceContext?.name || "this prospect"}
              pilotPath={data.pilotPath}
              pilotUrl={pilotUrl}
              renderer={renderer}
            />
          )}

          {pilotReady && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-foreground">
                  Sample questions to try in the chatbot
                </h2>
              </div>
              <div className="space-y-2">
                {sampleQuestions.map((question, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-border bg-card text-sm text-muted-foreground"
                  >
                    {question}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground text-center">
          Internal use only
        </p>
      </footer>
    </div>
  )
}

function ResultCard({
  ready,
  href,
  icon,
  title,
  waiting,
  ready_text,
  external,
}: {
  ready: boolean
  href: string
  icon: React.ReactNode
  title: string
  waiting: string
  ready_text: string
  external?: boolean
}) {
  if (!ready) {
    return (
      <Card className="border-border/50 bg-card/50 cursor-not-allowed opacity-60">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              {icon}
            </div>
            <CardTitle className="text-base font-medium text-muted-foreground">
              {title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{waiting}</p>
        </CardContent>
      </Card>
    )
  }
  const inner = (
    <Card className="border-border bg-card hover:bg-secondary cursor-pointer transition-colors h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            {icon}
          </div>
          <CardTitle className="text-base font-medium text-foreground">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{ready_text}</p>
      </CardContent>
    </Card>
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    )
  }
  return <Link href={href}>{inner}</Link>
}

const TIER_META: Record<
  RendererTier,
  { label: string; tone: string; toneClass: string; chip: string; headline: string; body: string }
> = {
  proxy: {
    label: "Full mirror",
    tone: "green",
    toneClass:
      "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    chip: "bg-emerald-500 text-emerald-50",
    headline: "We fully mirrored the prospect's site.",
    body:
      "This is what the prospect will see when they click your link — their own site, with our chatbot embedded. Safe to share without a preview, but a quick look never hurts.",
  },
  claude: {
    label: "Brand-matched recreation",
    tone: "amber",
    toneClass: "bg-amber-500/15 text-amber-200 border-amber-500/40",
    chip: "bg-amber-500 text-amber-50",
    headline: "We recreated their look-and-feel from extracted brand colours and content.",
    body:
      "We couldn't fully mirror the prospect's site — likely a single-page app, blocked our request, or loaded too sparsely. Recommend previewing before sharing.",
  },
  template: {
    label: "Generic template with their content",
    tone: "red",
    toneClass: "bg-red-500/15 text-red-200 border-red-500/40",
    chip: "bg-red-500 text-red-50",
    headline:
      "We weren't able to extract enough visual data to recreate their design.",
    body:
      "The pilot uses a generic dental template populated with their real practice info. Strongly recommend previewing before sharing — or running a different prospect URL if visual fidelity matters.",
  },
}

function PilotReadyCard({
  practiceName,
  pilotPath,
  pilotUrl,
  renderer,
}: {
  practiceName: string
  pilotPath: string
  pilotUrl: string
  renderer: RendererInfo
}) {
  const [copied, setCopied] = useState(false)
  const tier = renderer?.tier
  const meta = tier ? TIER_META[tier] : null

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(pilotUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore — fallback below shows the URL plainly
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Pilot ready</h2>
          <p className="text-xs text-muted-foreground">
            Share this link with {practiceName} after a quick preview.
          </p>
        </div>
        {meta ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider border ${meta.toneClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.chip}`} />
            {meta.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider border bg-muted text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Deciding renderer
          </span>
        )}
      </div>

      {meta && (
        <div className="rounded-lg bg-secondary/40 border border-border/60 p-3 space-y-1">
          <p className="text-sm font-medium text-foreground">{meta.headline}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{meta.body}</p>
          {renderer?.reason && (
            <p className="text-[11px] text-muted-foreground/70 font-mono pt-1">
              {renderer.reason}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
        <code className="flex-1 truncate text-xs font-mono text-foreground" title={pilotUrl}>
          {pilotUrl || pilotPath}
        </code>
        <button
          type="button"
          onClick={copyUrl}
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary hover:bg-secondary/80 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={pilotPath}
          target="_blank"
          rel="noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Preview pilot before sharing
        </a>
      </div>

      {tier !== "proxy" && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-100/90 leading-relaxed">
            Take a moment to open the pilot and check the result before sending the URL — visual fidelity is lower than the &ldquo;Full mirror&rdquo; tier.
          </p>
        </div>
      )}
    </div>
  )
}
