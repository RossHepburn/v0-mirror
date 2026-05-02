import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  wrapLanguageModel,
  type UIMessage,
} from "ai";
import { gateway } from "@ai-sdk/gateway";
import { mubitMemoryMiddleware } from "@mubit-ai/ai-sdk";
import { after } from "next/server";
import { z } from "zod";
import {
  mockPracticeContext,
  practiceContextAsSystemFacts,
  type PracticeContext,
} from "@/lib/practice-context";
import { createBooking } from "@/lib/booking";
import {
  mubit,
  sessionFor,
  lessonsForChat,
} from "@/lib/mubit";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatBody = {
  messages: UIMessage[];
  practiceContext?: PracticeContext;
  visitorId?: string;
};

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const text = m.parts
      ?.map((p) => (p.type === "text" ? (p as { text?: string }).text || "" : ""))
      .join(" ")
      .trim();
    if (text) return text;
  }
  return "";
}

function buildSystemPrompt(ctx: PracticeContext, lessons: string | null): string {
  const facts = practiceContextAsSystemFacts(ctx);
  const lessonBlock = lessons
    ? [
        ``,
        `=== LESSONS FROM PRIOR PROSPECTS (Mubit cross-prospect lane) ===`,
        lessons,
        `=== END LESSONS ===`,
        `Use these as soft guidance about which framings convert. Never invent facts from them.`,
      ].join("\n")
    : "";
  return [
    `You are the website assistant for ${ctx.name}, a UK dental practice.`,
    `Speak warmly, professionally and concisely — like a friendly receptionist. Use British English.`,
    `Answer ONLY using the practice facts below. If the answer isn't in those facts, do NOT guess — say:`,
    `"That's a great question — let me have the team get back to you on that. Could I take your name and a contact number?"`,
    `Never invent prices, hours, practitioners, treatments, NHS availability or clinical advice. If asked for clinical diagnosis, gently decline and recommend booking a consultation.`,
    ``,
    `When a visitor asks to book, gather the practitioner (or treatment), preferred date/time, and the patient's name + phone or email, then call the book_appointment tool.`,
    `After the tool returns, confirm the booking back to the visitor in plain English including the reference number.`,
    ``,
    `=== PRACTICE FACTS ===`,
    facts,
    `=== END PRACTICE FACTS ===`,
    lessonBlock,
  ].join("\n");
}

const bookAppointmentTool = (ctx: PracticeContext, visitorId: string) =>
  tool({
    description:
      "Book an appointment for a patient with a named practitioner at a specific date/time. Only call this after collecting practitioner, date, time, patient name and a contact (phone or email).",
    inputSchema: z.object({
      practitioner: z.string(),
      date: z.string().describe("ISO date YYYY-MM-DD"),
      time: z.string().describe("Local time HH:mm (24h)"),
      patientName: z.string(),
      patientContact: z.string(),
      treatment: z.string().optional(),
    }),
    execute: async (input) => {
      const result = await createBooking(input);
      // Best-effort cross-prospect lesson capture, after the response.
      after(async () => {
        try {
          const { recordConversion } = await import("@/lib/mubit");
          await recordConversion({
            practiceSlug: ctx.slug,
            visitorId,
            trigger: "booking_form",
            question: input.treatment ? `Booking for ${input.treatment}` : "Booking request",
            lastBotMessage: `Booked ${result.appointment.practitioner} on ${result.appointment.date} at ${result.appointment.time} (ref ${result.reference}).`,
          });
        } catch (err) {
          console.error("[chat-route] recordConversion failed:", err);
        }
      });
      return result;
    },
  });

export async function POST(req: Request) {
  const body = (await req.json()) as ChatBody;
  const ctx = body.practiceContext ?? mockPracticeContext;
  const visitorId = body.visitorId || "anon";
  const session = sessionFor(ctx.slug, visitorId);

  // One explicit recall against the cross-prospect lane for this turn's
  // user query. Per Session D's verified pattern (SPEC §3 supersede).
  const userQuery = lastUserText(body.messages);
  const lessons = userQuery ? await lessonsForChat(userQuery) : null;

  const wrapped = wrapLanguageModel({
    model: gateway("anthropic/claude-sonnet-4.5"),
    middleware: mubitMemoryMiddleware({
      mubitClient: mubit(),
      sessionId: session,
      agentId: "mirror-chatbot",
      injectLessons: false, // we inject manually above; middleware just captures
      captureInteractions: true,
      failOpen: true,
      scheduleIngest: (task) => after(() => task()),
    }),
  });

  const result = streamText({
    model: wrapped,
    system: buildSystemPrompt(ctx, lessons?.summary || null),
    messages: await convertToModelMessages(body.messages),
    tools: { book_appointment: bookAppointmentTool(ctx, visitorId) },
    stopWhen: stepCountIs(5),
    providerOptions: {
      gateway: {
        tags: ["mirror", "chatbot", `practice:${ctx.slug}`],
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
