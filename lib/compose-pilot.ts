import { createClient } from "v0-sdk";
import type { PracticeContext } from "./practice-context";
import type { VisualTokens } from "./visual-tokens";

const v0 = createClient({ apiKey: process.env.V0_API_KEY });

export type V0PilotResult = {
  chatId: string;
  demoUrl: string;
  webUrl: string;
  versionId?: string;
  status: "pending" | "completed" | "failed";
  ms: number;
};

function buildSystemPrompt() {
  return [
    "You are a senior front-end engineer building a Next.js page that mirrors the visual style of a UK dental practice's homepage.",
    "Output a polished, production-grade single-page site using Tailwind CSS and shadcn/ui where appropriate.",
    "All copy must come from the supplied practice data — never invent prices, treatments, practitioners, or addresses.",
    "Sections required: top nav with practice name, hero with practice tagline + primary CTA, treatments grid, meet-the-team grid, opening-hours / contact card, footer.",
    "Add testimonials and trust-badge sections only if the data implies them.",
    "Use exactly the supplied brand colours (primary/secondary/accent) and font families. Do not pick alternatives.",
    "Do not include a chatbot, contact form, or any backend logic — the host page injects its own chat widget over the top.",
    "Make sure the page reads like a real dental practice site, not a SaaS landing page. Image-led, calm, professional.",
  ].join(" \n");
}

function buildUserMessage(opts: {
  url: string;
  ctx: PracticeContext;
  visual: VisualTokens;
}) {
  const { url, ctx, visual } = opts;
  const data = {
    sourceUrl: url,
    practice: {
      name: ctx.name,
      tagline: ctx.tagline,
      address: ctx.address,
      phone: ctx.phone,
      email: ctx.email,
      nhsAccepted: ctx.nhsAccepted,
      privateOnly: ctx.privateOnly,
      hours: ctx.hours,
      practitioners: ctx.practitioners,
      treatments: ctx.treatments,
    },
    visualIdentity: {
      primary: visual.primary,
      secondary: visual.secondary,
      accent: visual.accent,
      background: visual.background,
      text: visual.text,
      fontHeading: visual.fontHeading,
      fontBody: visual.fontBody,
      mood: visual.mood,
    },
  };
  return [
    `Build the homepage for ${ctx.name} (${url}).`,
    "",
    "Use the data and visual identity below verbatim:",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
    "",
    "Constraints:",
    "- Use the exact hex colours and fonts supplied.",
    "- Render every practitioner and treatment from the data.",
    "- If a treatment has a price range, show it. If only a 'from' price, show 'from £X'. Otherwise omit price.",
    "- The page must look distinctly like this practice's site, not a generic dental template.",
    "- No external API calls; no chatbot or form (handled separately).",
  ].join("\n");
}

export async function composePilotWithV0(opts: {
  url: string;
  ctx: PracticeContext;
  visual: VisualTokens;
}): Promise<V0PilotResult> {
  const t0 = Date.now();
  // Async mode: chat returns immediately with a pending version. The demoUrl
  // is live the moment the version exists — v0 streams the build into the
  // hosted preview, so the user sees a real page within ~10s and the final
  // result fills in over the next 30-60s. We poll briefly to grab the demoUrl
  // (occasionally it isn't on the initial response yet) and capture status.
  const chat = (await v0.chats.create({
    message: buildUserMessage(opts),
    system: buildSystemPrompt(),
    chatPrivacy: "private",
    responseMode: "async",
    modelConfiguration: { thinking: false },
    metadata: { source: "mirror", host: new URL(opts.url).host },
  })) as any;

  const chatId = chat.id;
  const webUrl = chat.webUrl;
  let version = chat.latestVersion;

  // In async mode, the version (and its demoUrl) typically surface ~30-60s
  // after create. Poll until we have a demoUrl, then return — the iframe
  // will show v0's live build state as the version transitions to completed.
  const POLL_TIMEOUT_MS = 90_000;
  const POLL_INTERVAL_MS = 2_000;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while ((!version || !version.demoUrl) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const fresh = (await v0.chats.getById({ chatId })) as any;
      version = fresh.latestVersion;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("404") || msg.includes("chat_not_found")) continue;
      throw e;
    }
  }

  if (!version?.demoUrl) {
    throw new Error(
      `v0 returned no demoUrl after ${POLL_TIMEOUT_MS / 1000}s (chatId=${chatId} status=${version?.status ?? "?"})`,
    );
  }

  return {
    chatId,
    demoUrl: version.demoUrl,
    webUrl,
    versionId: version.id,
    status: version.status ?? "pending",
    ms: Date.now() - t0,
  };
}
