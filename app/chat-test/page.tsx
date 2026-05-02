"use client";

import { Chatbot } from "@/components/chatbot/Chatbot";
import { mockPracticeContext } from "@/lib/practice-context";

const QUICK_TESTS = [
  "Do you do Invisalign?",
  "How much is teeth whitening?",
  "Who would I see for dental implants?",
  "What are your opening hours on Wednesday?",
  "Do you take NHS patients?",
] as const;

export default function ChatTestPage() {
  function send(text: string) {
    // Drop the question into the input and submit by simulating an Enter press.
    // Simpler approach: dispatch a custom event the Chatbot doesn't currently
    // listen to — instead we click the input via a ref-less trick: write to a
    // hidden form field and submit. To keep things simple and obviously
    // working, we just put it on the clipboard-style state via window event.
    window.dispatchEvent(
      new CustomEvent("mirror-chat-prefill", { detail: text }),
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">
            Chatbot smoke test — {mockPracticeContext.name}
          </h1>
          <p className="text-sm text-neutral-600">
            Streaming chat with a stubbed booking tool. Brand colours come from
            <code className="mx-1 rounded bg-neutral-200 px-1 text-xs">practiceContext.brand</code>.
          </p>
        </header>

        <section className="flex flex-wrap gap-2">
          {QUICK_TESTS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-500 hover:text-neutral-900"
            >
              {q}
            </button>
          ))}
          <button
            onClick={() =>
              send(
                "Please book me with Dr Anya Patel on 2026-05-12 at 10:00 for an Invisalign consultation. Patient name Ross Hepburn, phone 07700 900123.",
              )
            }
            className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
          >
            Book Dr Patel · 12 May 10:00 (full booking flow)
          </button>
          <button
            onClick={() =>
              send("Do you do dental tourism packages to Turkey?")
            }
            className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs text-rose-900 hover:bg-rose-100"
          >
            Hallucination guard test (out-of-scope question)
          </button>
        </section>

        <Chatbot practiceContext={mockPracticeContext} />
      </div>
    </div>
  );
}
