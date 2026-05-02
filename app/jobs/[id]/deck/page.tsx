"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  Building2,
  Search,
  Users,
  MessageSquare,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Brain,
  Loader2,
} from "lucide-react"

type BattleCard = {
  practiceSnapshot: string
  websiteGapAnalysis: string
  competitiveLandscape: { name: string; insight: string }[]
  chatbotPitch: string
  estimatedImpact: string
  openingLines: string[]
  fitSignal: { score: "strong" | "medium" | "weak"; rationale: string }
  lessonsFromPastProspects: string | null
}

type StatusResponse = {
  practiceContext: { name: string } | null
  battleCard: BattleCard | null
  url: string
  error: string | null
}

export default function BattleCardPage() {
  const params = useParams()
  const jobId = params.id as string
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

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
        setLoading(false)
        if (!body.battleCard && !body.error) {
          timer = setTimeout(tick, 2000)
        }
      } catch {
        if (cancelled) return
        timer = setTimeout(tick, 3000)
      }
    }
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId])

  const card = data?.battleCard

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/jobs/${jobId}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to job</span>
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
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">
              {data?.practiceContext?.name || "Sales Battle Card"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Briefing deck • Job: {jobId.slice(0, 8)}…
              {data?.url && (
                <>
                  {" "}
                  ·{" "}
                  <a className="underline" href={data.url} target="_blank" rel="noreferrer">
                    {data.url}
                  </a>
                </>
              )}
            </p>
          </div>

          {loading && !card && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading battle card…
            </div>
          )}

          {card && (
            <div className="space-y-4">
              <Section icon={Building2} title="Practice snapshot" body={card.practiceSnapshot} />
              <Section icon={Search} title="Website gap analysis" body={card.websiteGapAnalysis} />

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-base font-medium text-foreground">
                      Competitive landscape
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {card.competitiveLandscape.map((c, i) => (
                    <div key={i} className="border-l-2 border-primary/40 pl-3">
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      <p className="text-sm text-muted-foreground">{c.insight}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Section
                icon={MessageSquare}
                title="The chatbot pitch, made concrete"
                body={card.chatbotPitch}
              />
              <Section icon={TrendingUp} title="Estimated impact" body={card.estimatedImpact} />

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-base font-medium text-foreground">
                      Three opening lines
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2 list-decimal pl-5">
                    {card.openingLines.map((line, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {line}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-base font-medium text-foreground">
                      Fit signal
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={
                        "px-2 py-0.5 rounded-full text-xs font-medium " +
                        (card.fitSignal.score === "strong"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : card.fitSignal.score === "medium"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-red-500/20 text-red-300")
                      }
                    >
                      {card.fitSignal.score.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{card.fitSignal.rationale}</p>
                </CardContent>
              </Card>

              {card.lessonsFromPastProspects && (
                <Card className="border-primary/40 bg-primary/5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Brain className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base font-medium text-foreground">
                        Lessons from past prospects
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {card.lessonsFromPastProspects}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      Surfaced via Mubit cross-prospect lessons lane.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground text-center">Internal use only</p>
      </footer>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-base font-medium text-foreground">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{body}</p>
      </CardContent>
    </Card>
  )
}
