import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import {
  mockPracticeContext,
  practiceContextAsSystemFacts,
  type PracticeContext,
} from "@/lib/practice-context";
import { createBooking } from "@/lib/booking";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatBody = {
  messages: UIMessage[];
  practiceContext?: PracticeContext;
};

function buildSystemPrompt(ctx: PracticeContext): string {
  const facts = practiceContextAsSystemFacts(ctx);
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
  ].join("\n");
}

const bookAppointmentTool = tool({
  description:
    "Book an appointment for a patient with a named practitioner at a specific date/time. Only call this after collecting practitioner, date, time, patient name and a contact (phone or email).",
  inputSchema: z.object({
    practitioner: z.string().describe("Practitioner name (must match one of the practice's practitioners)"),
    date: z.string().describe("ISO date YYYY-MM-DD"),
    time: z.string().describe("Local time HH:mm (24h)"),
    patientName: z.string().describe("Full name of the patient"),
    patientContact: z.string().describe("Phone number or email address for the patient"),
    treatment: z.string().optional().describe("Treatment / appointment type if known"),
  }),
  execute: async (input) => createBooking(input),
});

export async function POST(req: Request) {
  const body = (await req.json()) as ChatBody;
  const ctx = body.practiceContext ?? mockPracticeContext;

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    system: buildSystemPrompt(ctx),
    messages: await convertToModelMessages(body.messages),
    tools: { book_appointment: bookAppointmentTool },
    stopWhen: stepCountIs(5),
    providerOptions: {
      gateway: {
        tags: ["mirror", "chatbot", `practice:${ctx.slug}`],
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
