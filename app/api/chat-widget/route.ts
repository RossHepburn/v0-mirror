import { streamText, wrapLanguageModel, type ModelMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { mubitMemoryMiddleware } from "@mubit-ai/ai-sdk";
import { after } from "next/server";
import {
  practiceContextAsSystemFacts,
  type PracticeContext,
} from "@/lib/practice-context";
import { mubit, sessionFor, lessonsForChat } from "@/lib/mubit";
import { readJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

type WidgetChatBody = {
  jobId: string;
  visitorId?: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

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
    `If a visitor asks to book, gather practitioner (or treatment), preferred date/time, and the patient's name + phone or email, then tell them you've passed it to the team.`,
    ``,
    `=== PRACTICE FACTS ===`,
    facts,
    `=== END PRACTICE FACTS ===`,
    lessonBlock,
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as WidgetChatBody;
  if (!body?.jobId) {
    return new Response("missing jobId", { status: 400 });
  }
  const job = await readJob(body.jobId);
  if (!job || !job.practiceContext) {
    return new Response("job not found", { status: 404 });
  }
  const ctx = job.practiceContext;
  const visitorId = body.visitorId || "widget-anon";
  const session = sessionFor(ctx.slug, visitorId);

  const userQuery = [...body.messages].reverse().find((m) => m.role === "user")?.content || "";
  const lessons = userQuery ? await lessonsForChat(userQuery) : null;

  const wrapped = wrapLanguageModel({
    model: gateway("anthropic/claude-sonnet-4.5"),
    middleware: mubitMemoryMiddleware({
      mubitClient: mubit(),
      sessionId: session,
      agentId: "mirror-widget",
      injectLessons: false,
      captureInteractions: true,
      failOpen: true,
      scheduleIngest: (task) => after(() => task()),
    }),
  });

  const modelMessages: ModelMessage[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = streamText({
    model: wrapped,
    system: buildSystemPrompt(ctx, lessons?.summary || null),
    messages: modelMessages,
    providerOptions: {
      gateway: {
        tags: ["mirror", "widget", `practice:${ctx.slug}`],
      },
    },
  });

  return result.toTextStreamResponse();
}
