import { setStep, updateJob } from "./jobs";
import { profileProspect } from "./profile-prospect";
import { extractVisualTokens } from "./visual-tokens";
import { fromProfile } from "./practice-context";
import { generateBattleCard } from "./battle-card";

export async function runBuildPilot(jobId: string, url: string): Promise<void> {
  try {
    // Step 1: Analyse the prospect (BD scrape + profile + visual tokens in parallel)
    await setStep(jobId, "analyse", "in-progress");
    const [extraction, visual] = await Promise.all([
      profileProspect(url),
      extractVisualTokens(url),
    ]);
    const ctx = fromProfile(extraction.profile, visual, {
      url,
      phones: extraction.phones,
      logo: extraction.logo,
    });
    await updateJob(jobId, (job) => {
      job.profile = extraction.profile;
      job.visual = visual;
      job.practiceContext = ctx;
    });
    await setStep(jobId, "analyse", "complete");

    // Step 2: Battle card with competitive landscape + Mubit lessons
    await setStep(jobId, "competitors", "in-progress");
    const card = await generateBattleCard(extraction.profile, ctx, url);
    await updateJob(jobId, (job) => {
      job.battleCard = {
        practiceSnapshot: card.practiceSnapshot,
        websiteGapAnalysis: card.websiteGapAnalysis,
        competitiveLandscape: card.competitiveLandscape,
        chatbotPitch: card.chatbotPitch,
        estimatedImpact: card.estimatedImpact,
        openingLines: card.openingLines,
        fitSignal: card.fitSignal,
        lessonsFromPastProspects: card.lessonsFromPastProspects,
      };
    });
    await setStep(jobId, "competitors", "complete");

    // Step 3: Pilot site — Option A: render an in-app multi-tenant template
    // at /p/[id]. No external deploy needed; the route reads the job state.
    await setStep(jobId, "pilot", "in-progress");
    const pilotPath = `/p/${jobId}`;
    await updateJob(jobId, (job) => {
      job.pilotPath = pilotPath;
    });
    await setStep(jobId, "pilot", "complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[build-pilot ${jobId}] failed:`, err);
    await updateJob(jobId, (job) => {
      job.error = message;
      const inProgress = job.steps.find((s) => s.status === "in-progress");
      if (inProgress) {
        inProgress.status = "error";
        inProgress.error = message;
        inProgress.finishedAt = new Date().toISOString();
      }
    });
  }
}
