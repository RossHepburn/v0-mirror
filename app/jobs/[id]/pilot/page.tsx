"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PilotSitePage() {
  const params = useParams()
  const jobId = params.id as string
  
  // Generate a fake deployment URL
  const pilotUrl = `pilot-${jobId.slice(0, 8)}.mirror-preview.app`

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
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

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="text-center space-y-6 max-w-md">
          {/* Icon */}
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Globe className="h-8 w-8 text-primary" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              Pilot site will appear here
            </h1>
            <p className="text-sm text-muted-foreground">
              Once built, the pilot site will be deployed to:
            </p>
          </div>

          {/* URL Preview */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <code className="text-sm font-mono text-foreground">
                {pilotUrl}
              </code>
            </div>
          </div>

          {/* Coming Soon Note */}
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              The pilot site will mirror the prospect&apos;s branding and include our chatbot pre-configured to answer their customers&apos; questions.
            </p>
            
            <Button variant="secondary" disabled className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Pilot Site
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground text-center">
          Internal use only
        </p>
      </footer>
    </div>
  )
}
