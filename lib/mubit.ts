import { Client } from "@mubit-ai/sdk";

let _client: Client | null = null;

export function mubit(): Client {
  if (_client) return _client;
  if (!process.env.MUBIT_API_KEY) throw new Error("MUBIT_API_KEY missing");
  _client = new Client({
    api_key: process.env.MUBIT_API_KEY,
    transport: "http",
  });
  return _client;
}

export const sessionFor = (practiceSlug: string, visitorId: string) =>
  `mirror::${practiceSlug}::${visitorId}`;

export const PROJECT_LANE_SESSION = "mirror::project::shared-knowledge";

export type RecallResult = {
  summary: string;
  evidence: { content?: string; metadata?: Record<string, unknown> }[];
};

async function safeRecall(query: string): Promise<RecallResult | null> {
  try {
    const c = mubit();
    const result = await c.recall({
      session_id: PROJECT_LANE_SESSION,
      query,
      entry_types: ["lesson", "rule"],
    } as Parameters<Client["recall"]>[0]);
    const summary =
      (result as { final_answer?: string }).final_answer ||
      (result as { summary?: string }).summary ||
      "";
    const evidence = ((result as { evidence?: unknown[] }).evidence || []) as RecallResult["evidence"];
    if (!summary && evidence.length === 0) return null;
    return { summary, evidence };
  } catch (err) {
    console.error("[mubit.safeRecall] failed:", err);
    return null;
  }
}

export async function lessonsForChat(query: string): Promise<RecallResult | null> {
  return safeRecall(query);
}

export async function battleCardInsights(query: string): Promise<RecallResult | null> {
  return safeRecall(query);
}

export type ConversionEvent = {
  practiceSlug: string;
  visitorId: string;
  trigger: "booking_form" | "phone_click" | "callback";
  question: string;
  lastBotMessage: string;
};

export async function recordConversion(ev: ConversionEvent): Promise<void> {
  try {
    const c = mubit();
    const session = sessionFor(ev.practiceSlug, ev.visitorId);

    await c.remember({
      session_id: session,
      agent_id: "mirror-chatbot",
      intent: "lesson",
      lesson_type: "success",
      content:
        `Prospect on ${ev.practiceSlug} converted via ${ev.trigger} after the bot answered: ` +
        `"${ev.question}" with: "${ev.lastBotMessage}".`,
      metadata: { practiceSlug: ev.practiceSlug, trigger: ev.trigger },
    } as Parameters<Client["remember"]>[0]);

    await c.remember({
      session_id: PROJECT_LANE_SESSION,
      agent_id: "mirror-chatbot",
      intent: "lesson",
      lesson_type: "success",
      content:
        `When a UK dental prospect asks "${ev.question}", a response in the style of ` +
        `"${ev.lastBotMessage}" tends to convert via ${ev.trigger}.`,
      metadata: { source_practice: ev.practiceSlug, trigger: ev.trigger },
    } as Parameters<Client["remember"]>[0]);

    await (c as unknown as {
      recordOutcome?: (a: { session_id: string; outcome: string; rationale?: string }) => Promise<unknown>;
    }).recordOutcome?.({
      session_id: session,
      outcome: "success",
      rationale: `Visitor triggered ${ev.trigger}`,
    });
  } catch (err) {
    console.error("[mubit.recordConversion] failed:", err);
  }
}
