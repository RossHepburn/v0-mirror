import { generateObject } from "ai";
import { z } from "zod";
import type { PracticeProfile } from "./profile-prospect";
import type { PracticeContext } from "./practice-context";
import { battleCardInsights } from "./mubit";

const Competitor = z.object({
  name: z.string(),
  insight: z.string(),
});

const BattleCardSchema = z.object({
  practiceSnapshot: z.string().describe("3-5 sentences summarising who the prospect is."),
  websiteGapAnalysis: z.string().describe("What their website does poorly today."),
  competitiveLandscape: z.array(Competitor),
  chatbotPitch: z.string().describe("Concrete benefits Mirror's chatbot would bring to THIS practice."),
  estimatedImpact: z.string().describe("Plain-English ROI estimate."),
  openingLines: z.array(z.string()).describe("Three opening lines for the salesperson to use."),
  fitSignal: z.object({
    score: z.enum(["strong", "medium", "weak"]),
    rationale: z.string(),
  }),
});

export type BattleCardData = z.infer<typeof BattleCardSchema>;

const FALLBACK_COMPETITORS = [
  "Bupa Dental",
  "{my}dentist",
  "Local independent practice (e.g. Smile Cliniq)",
];

async function searchCompetitors(ctx: PracticeContext): Promise<string[]> {
  // Lightweight: derive 3 likely competitors from the address + signature treatments.
  // (The competitive-intel skill could deepen this, but for hackathon time pressure we
  // hand the LLM the prospect facts + a list of known UK dental brands and let it
  // write defensible commentary. The LLM's web grounding is not needed for the demo.)
  const seeds = [...FALLBACK_COMPETITORS];
  if (ctx.privateOnly) seeds.unshift("Smile Cliniq (private cosmetic-led)");
  if (ctx.nhsAccepted) seeds.unshift("NHS-led local practices");
  return seeds.slice(0, 3);
}

export async function generateBattleCard(
  profile: PracticeProfile,
  ctx: PracticeContext,
  url: string,
): Promise<BattleCardData & { lessonsFromPastProspects: string | null }> {
  const competitors = await searchCompetitors(ctx);

  const lessonsQuery =
    `What objections and questions tend to come up for UK dental prospects offering ${ctx.treatments
      .slice(0, 4)
      .map((t) => t.name)
      .join(", ")}, and which chatbot framings convert best?`;
  const lessons = await battleCardInsights(lessonsQuery);

  const lessonContext = lessons?.summary
    ? `\n\nLessons learned from prior Mirror prospects:\n${lessons.summary}`
    : "";

  const prompt = [
    `You are writing a sales battle card for the Mirror team to sell our AI receptionist chatbot to a UK dental practice.`,
    `Prospect URL: ${url}`,
    `Practice name: ${ctx.name}`,
    `Address: ${ctx.address}`,
    `NHS accepted: ${ctx.nhsAccepted ? "yes" : "no"}${ctx.privateOnly ? " (private only)" : ""}`,
    ``,
    `Signature treatments: ${profile.signatureTreatments.join(", ") || "n/a"}`,
    `Battlecard hooks suggested by the scrape: ${profile.battlecardHooks.join("; ") || "n/a"}`,
    ``,
    `Likely local competitors to discuss: ${competitors.join("; ")}.`,
    `For each competitor, write a single sentence about how they likely handle inbound enquiries today (phone-only, generic chatbot, online booking, etc.) and where Mirror would win.`,
    ``,
    `Estimated impact: ground in plausible UK dental industry numbers (missed-call rates 30-40%, average new patient value £150-£500, etc.).`,
    `Opening lines: three short, specific, friendly conversation starters tailored to THIS practice.`,
    `Fit signal: 'strong' if private-led with cosmetic/Invisalign/implants focus, 'medium' for mixed practices, 'weak' for purely NHS.`,
    lessonContext,
  ].join("\n");

  const { object } = await generateObject({
    model: "anthropic/claude-sonnet-4.5",
    schema: BattleCardSchema,
    system:
      "You write crisp, specific, defensible sales battle cards. Avoid generic copy. " +
      "Anchor every claim in the prospect's actual facts.",
    prompt,
    temperature: 0.3,
    providerOptions: {
      gateway: {
        tags: ["mirror", "battle-card", `practice:${ctx.slug}`],
      },
    },
  });

  return {
    ...object,
    lessonsFromPastProspects: lessons?.summary || null,
  };
}
