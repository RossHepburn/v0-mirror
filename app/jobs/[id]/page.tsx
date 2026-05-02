"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Loader2, Clock, FileText, Globe, ArrowLeft, MessageSquare, AlertTriangle } from "lucide-react"

type ApiStep = {
  key: "analyse" | "competitors" | "pilot"
  name: string
  estimate: string
  status: "pending" | "in-progress" | "complete" | "error"
  error?: string
}

type StatusResponse = {
  id: string
  url: string
  steps: ApiStep[]
  pilotPath: string | null
  practiceContext: { slug: string; name: string } | null
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
