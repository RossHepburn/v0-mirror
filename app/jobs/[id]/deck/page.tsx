"use client"

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
  CheckCircle2
} from "lucide-react"

const sections = [
  {
    title: "Prospect snapshot",
    icon: Building2,
    description: "Key information about the prospect's business",
  },
  {
    title: "Website gap analysis",
    icon: Search,
    description: "What's missing from their current website",
  },
  {
    title: "Competitive landscape",
    icon: Users,
    description: "How competitors are handling customer enquiries",
  },
  {
    title: "The chatbot pitch, made concrete",
    icon: MessageSquare,
    description: "Specific benefits tailored to this prospect",
  },
  {
    title: "Estimated impact",
    icon: TrendingUp,
    description: "Projected improvements and ROI",
  },
  {
    title: "Three opening lines",
    icon: Sparkles,
    description: "Conversation starters for your meeting",
  },
  {
    title: "Fit signal",
    icon: CheckCircle2,
    description: "How well this prospect matches our ideal customer",
  },
]

export default function BattleCardPage() {
  const params = useParams()
  const jobId = params.id as string

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
      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Page Title */}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Sales Battle Card</h1>
            <p className="text-sm text-muted-foreground">
              Briefing deck for your meeting • Job: {jobId.slice(0, 8)}...
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((section, index) => {
              const Icon = section.icon
              return (
                <Card key={index} className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-medium text-foreground">
                          {section.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-24 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
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
