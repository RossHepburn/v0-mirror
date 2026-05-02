"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import type { PracticeContext } from "@/lib/practice-context";

type ChatbotProps = {
  practiceContext: PracticeContext;
  greeting?: string;
};

type BookingResult = {
  ok: boolean;
  reference?: string;
  appointment?: {
    practitioner: string;
    date: string;
    time: string;
    treatment?: string;
  };
  patient?: { name: string; contact: string };
  error?: string;
};

export function Chatbot({ practiceContext, greeting }: ChatbotProps) {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { practiceContext },
    }),
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) {
        sendMessage({ text: detail });
      }
    }
    window.addEventListener("mirror-chat-prefill", handler);
    return () => window.removeEventListener("mirror-chat-prefill", handler);
  }, [sendMessage]);

  const brand = practiceContext.brand;
  const sending = status === "submitted" || status === "streaming";

  const themeStyle = {
    "--brand-primary": brand.primary,
    "--brand-secondary": brand.secondary,
    "--brand-accent": brand.accent,
    fontFamily: brand.fontFamily ?? "Inter, system-ui, sans-serif",
  } as React.CSSProperties;

  const initialGreeting =
    greeting ??
    `Hi! I'm the ${practiceContext.name} assistant. Ask me about treatments, prices, our team or book an appointment.`;

  function handleSubmit(text?: string) {
    const value = (text ?? input).trim();
    if (!value || sending) return;
    sendMessage({ text: value });
    setInput("");
  }

  return (
    <div
      className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-lg"
      style={{
        ...themeStyle,
        background: "white",
        border: `1px solid ${brand.primary}22`,
      }}
    >
      <header
        className="px-5 py-4 text-white"
        style={{ background: brand.primary }}
      >
        <div className="text-sm uppercase tracking-wide opacity-80">
          {practiceContext.name}
        </div>
        <div className="text-base font-semibold">Chat with our team</div>
      </header>

      <div
        ref={scrollRef}
        className="flex h-[480px] flex-col gap-3 overflow-y-auto p-5"
        style={{ background: brand.secondary }}
      >
        {messages.length === 0 && (
          <Bubble role="assistant" brand={brand}>
            {initialGreeting}
          </Bubble>
        )}

        {messages.map((m) => (
          <MessageView key={m.id} message={m} brand={brand} />
        ))}

        {sending && (
          <Bubble role="assistant" brand={brand}>
            <span className="inline-flex gap-1">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </span>
          </Bubble>
        )}

        {error && (
          <Bubble role="assistant" brand={brand}>
            <span style={{ color: "#b00020" }}>
              Something went wrong: {error.message}
            </span>
          </Bubble>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-black/5 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <input
          className="flex-1 rounded-full border border-black/10 px-4 py-2 outline-none focus:border-[var(--brand-primary)]"
          placeholder={sending ? "Replying…" : "Ask a question or book an appointment"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: brand.primary }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

type BrandProp = { brand: PracticeContext["brand"] };

function MessageView({
  message,
  brand,
}: { message: ReturnType<typeof useChat>["messages"][number] } & BrandProp) {
  const isUser = message.role === "user";

  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <Bubble key={i} role={isUser ? "user" : "assistant"} brand={brand}>
              {part.text}
            </Bubble>
          );
        }

        // Tool calls / results — handles dynamic-tool and named tool parts.
        if (part.type === "dynamic-tool" || part.type?.startsWith("tool-")) {
          // narrow: AI SDK exposes state on tool parts
          const toolPart = part as unknown as {
            type: string;
            toolName?: string;
            state?: string;
            input?: unknown;
            output?: unknown;
          };
          const toolName =
            toolPart.toolName ??
            (toolPart.type.startsWith("tool-")
              ? toolPart.type.slice("tool-".length)
              : "tool");

          if (toolName === "book_appointment") {
            return (
              <BookingCard
                key={i}
                state={toolPart.state}
                input={toolPart.input as Record<string, unknown> | undefined}
                output={toolPart.output as BookingResult | undefined}
                brand={brand}
              />
            );
          }

          return (
            <Bubble key={i} role="assistant" brand={brand}>
              <span className="opacity-70 text-xs">
                [{toolName} {toolPart.state ?? ""}]
              </span>
            </Bubble>
          );
        }
        return null;
      })}
    </div>
  );
}

function Bubble({
  role,
  brand,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
} & BrandProp) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm shadow-sm"
        style={{
          background: isUser ? brand.primary : "white",
          color: isUser ? "white" : "#1a1a1a",
          borderBottomRightRadius: isUser ? 4 : undefined,
          borderBottomLeftRadius: isUser ? undefined : 4,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BookingCard({
  state,
  input,
  output,
  brand,
}: {
  state?: string;
  input?: Record<string, unknown>;
  output?: BookingResult;
} & BrandProp) {
  const showOutput = state === "output-available" && output?.ok;
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] rounded-2xl border px-4 py-3 text-sm shadow-sm"
        style={{
          background: "white",
          borderColor: `${brand.accent}88`,
          borderBottomLeftRadius: 4,
        }}
      >
        <div
          className="mb-1 text-xs font-semibold uppercase tracking-wide"
          style={{ color: brand.primary }}
        >
          {showOutput ? "Booking confirmed" : "Booking…"}
        </div>
        {showOutput && output ? (
          <div className="space-y-1">
            <div>
              <strong>Reference:</strong> {output.reference}
            </div>
            <div>
              <strong>With:</strong> {output.appointment?.practitioner}
            </div>
            <div>
              <strong>When:</strong> {output.appointment?.date} at{" "}
              {output.appointment?.time}
            </div>
            {output.appointment?.treatment && (
              <div>
                <strong>Treatment:</strong> {output.appointment.treatment}
              </div>
            )}
            {output.patient && (
              <div>
                <strong>Patient:</strong> {output.patient.name} (
                {output.patient.contact})
              </div>
            )}
          </div>
        ) : input ? (
          <div className="space-y-1 opacity-80">
            <div>
              {String(input.practitioner ?? "")} on{" "}
              {String(input.date ?? "")} at {String(input.time ?? "")}
            </div>
            <div>
              {String(input.patientName ?? "")}{" "}
              {input.patientContact ? `· ${String(input.patientContact)}` : ""}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
