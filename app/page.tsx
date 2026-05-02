"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight } from "lucide-react"

export default function HomePage() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed (${res.status})`)
      }
      const { id } = await res.json()
      router.push(`/jobs/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start job")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">M</span>
          </div>
          <span className="text-sm font-medium text-foreground">Mirror</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-lg space-y-8">
          {/* Heading */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance">
              Build the mirror
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
              Generates a sales battle card and a working pilot site with our chatbot, configured for this prospect.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter the prospect's website URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 px-4 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Starting…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Build the mirror
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
          </form>
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
