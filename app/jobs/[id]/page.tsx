"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Loader2, Clock, FileText, Globe, ArrowLeft, MessageSquare } from "lucide-react"

type StepStatus = "pending" | "in-progress" | "complete"

interface Step {
  id: number
  name: string
  estimate: string
  status: StepStatus
  duration: number
}

const initialSteps: Step[] = [
  { id: 1, name: "Analysing the prospect", estimate: "~10s", status: "pending", duration: 3000 },
  { id: 2, name: "Identifying competitors", estimate: "~15s", status: "pending", duration: 4000 },
  { id: 3, name: "Building the pilot site", estimate: "~2m", status: "pending", duration: 5000 },
]

const sampleQuestions = [
  "What services do you offer for nervous patients?",
  "How much does a routine check-up cost?",
  "Do you accept NHS patients?",
  "What are your opening hours on weekends?",
  "How do I book an emergency appointment?",
]

export default function JobStatusPage() {
  const params = useParams()
  const jobId = params.id as string
  const [steps, setSteps] = useState<Step[]>(initialSteps)

  useEffect(() => {
    let currentStepIndex = 0

    const processNextStep = () => {
      if (currentStepIndex >= steps.length) return

      // Mark current step as in-progress
      setSteps((prev) =>
        prev.map((step, index) =>
          index === currentStepIndex ? { ...step, status: "in-progress" } : step
        )
      )

      // After duration, mark as complete and move to next
      const duration = initialSteps[currentStepIndex].duration
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((step, index) =>
            index === currentStepIndex ? { ...step, status: "complete" } : step
          )
        )
        currentStepIndex++
        processNextStep()
      }, duration)
    }

    // Start processing after a small delay
    const timer = setTimeout(processNextStep, 500)
    return () => clearTimeout(timer)
  }, [])

  const step1And2Complete = steps[0].status === "complete" && steps[1].status === "complete"
  const allStepsComplete = steps.every((step) => step.status === "complete")

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
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

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Job Reference */}
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Building Mirror</h1>
            <p className="text-sm text-muted-foreground font-mono">
              Job: {jobId.slice(0, 8)}...
            </p>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
              >
                {/* Status Icon */}
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
                </div>

                {/* Step Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      step.status === "pending"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.estimate}</p>
                </div>

                {/* Step Number */}
                <div className="flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    Step {index + 1}/{steps.length}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Result Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Sales Battle Card */}
            <Card
              className={`transition-all duration-300 ${
                step1And2Complete
                  ? "border-border bg-card hover:bg-secondary cursor-pointer"
                  : "border-border/50 bg-card/50 cursor-not-allowed opacity-60"
              }`}
            >
              {step1And2Complete ? (
                <Link href={`/jobs/${jobId}/deck`} className="block">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base font-medium text-foreground">
                        Sales Battle Card
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Briefing deck ready for your meeting
                    </p>
                  </CardContent>
                </Link>
              ) : (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-base font-medium text-muted-foreground">
                        Sales Battle Card
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Waiting for analysis to complete...
                    </p>
                  </CardContent>
                </>
              )}
            </Card>

            {/* Pilot Site */}
            <Card
              className={`transition-all duration-300 ${
                allStepsComplete
                  ? "border-border bg-card hover:bg-secondary cursor-pointer"
                  : "border-border/50 bg-card/50 cursor-not-allowed opacity-60"
              }`}
            >
              {allStepsComplete ? (
                <Link href={`/jobs/${jobId}/pilot`} className="block">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base font-medium text-foreground">
                        Pilot Site
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Preview site with embedded chatbot
                    </p>
                  </CardContent>
                </Link>
              ) : (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-base font-medium text-muted-foreground">
                        Pilot Site
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Building pilot site...
                    </p>
                  </CardContent>
                </>
              )}
            </Card>
          </div>

          {/* Sample Questions */}
          {allStepsComplete && (
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
                    className="p-3 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  >
                    {question}
                  </div>
                ))}
              </div>
            </div>
          )}
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
