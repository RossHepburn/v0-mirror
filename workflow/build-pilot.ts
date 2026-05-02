import { FatalError } from "workflow";
import { setStep, updateJob } from "@/lib/jobs";
import { profileProspect } from "@/lib/profile-prospect";
import { extractVisualTokens } from "@/lib/visual-tokens";
import { fromProfile } from "@/lib/practice-context";
import { generateBattleCard } from "@/lib/battle-card";

async function analyseStep(jobId: string, url: string) {
  "use step";
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
  return { profile: extraction.profile, ctx };
}

async function competitorsStep(
  jobId: string,
  url: string,
  payload: Awaited<ReturnType<typeof analyseStep>>,
) {
  "use step";
  await setStep(jobId, "competitors", "in-progress");
  const card = await generateBattleCard(payload.profile, payload.ctx, url);
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
}

async function pilotStep(jobId: string) {
  "use step";
  await setStep(jobId, "pilot", "in-progress");
  const pilotPath = `/p/${jobId}`;
  await updateJob(jobId, (job) => {
    job.pilotPath = pilotPath;
  });
  await setStep(jobId, "pilot", "complete");
}

async function markFailureStep(jobId: string, message: string) {
  "use step";
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

export async function buildPilotWorkflow(input: { jobId: string; url: string }) {
  "use workflow";

  const { jobId, url } = input;

  if (!url || !/^https?:\/\//i.test(url)) {
    await markFailureStep(jobId, `Invalid URL: ${url}`);
    throw new FatalError(`Invalid URL: ${url}`);
  }

  try {
    const analysed = await analyseStep(jobId, url);
    await competitorsStep(jobId, url, analysed);
    await pilotStep(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailureStep(jobId, message);
    throw err;
  }
}
