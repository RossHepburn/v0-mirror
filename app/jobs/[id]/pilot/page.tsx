"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type StatusResponse = {
  pilotPath: string | null
  practiceContext: { name: string } | null
}

export default function PilotSitePage() {
  const params = useParams()
  const jobId = params.id as string
  const [data, setData] = useState<StatusResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`, { cache: "no-store" })
        if (!res.ok) throw new Error()
        const body = (await res.json()) as StatusResponse
        if (cancelled) return
        setData(body)
        if (!body.pilotPath) timer = setTimeout(tick, 1500)
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

  const pilotPath = data?.pilotPath
  const fullUrl = typeof window !== "undefined" && pilotPath ? `${window.location.origin}${pilotPath}` : pilotPath || ""

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

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Globe className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              {data?.practiceContext?.name
                ? `Pilot site for ${data.practiceContext.name}`
                : "Pilot site"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {pilotPath
                ? "Branded preview, hosted on Mirror with the chatbot pre-configured."
                : "Building the pilot — this usually takes around a minute."}
            </p>
          </div>

          {pilotPath ? (
            <>
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm font-mono text-foreground break-all">{fullUrl}</code>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <a href={pilotPath} target="_blank" rel="noreferrer">
                  <Button className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open pilot site
                  </Button>
                </a>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building…
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
