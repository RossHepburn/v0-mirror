import { FatalError } from "workflow";
import { setStep, updateJob, readJob } from "@/lib/jobs";
import { profileProspect } from "@/lib/profile-prospect";
import { extractVisualTokens } from "@/lib/visual-tokens";
import { fromProfile } from "@/lib/practice-context";
import { generateBattleCard } from "@/lib/battle-card";
import { composeComponent, saveComponent, readComponent } from "@/lib/compose";
import { assessProxyViability } from "@/lib/proxy-html";
import type { RendererTier } from "@/lib/jobs";

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

async function composeStep(
  jobId: string,
  url: string,
  payload: Awaited<ReturnType<typeof analyseStep>>,
) {
  "use step";
  await setStep(jobId, "compose", "in-progress");
  const job = await readJob(jobId);
  if (!job?.visual) {
    // Soft-fail: mark complete so workflow can proceed; fallback chain will
    // pick template tier when no Claude component exists.
    await setStep(jobId, "compose", "complete", {
      error: "visual tokens missing — skipped Claude compose",
    });
    return;
  }
  try {
    const tsx = await composeComponent({
      url,
      practiceContext: payload.ctx,
      visual: job.visual,
    });
    await saveComponent(jobId, tsx);
    await updateJob(jobId, (j) => {
      j.componentBytes = tsx.length;
    });
    await setStep(jobId, "compose", "complete");
  } catch (err) {
    // Don't fail the job — Claude generation is a fallback option.
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[compose] step failed (non-fatal):", message);
    await setStep(jobId, "compose", "complete", {
      error: `compose failed (template fallback retained): ${message}`,
    });
  }
}

async function pilotStep(jobId: string, url: string) {
  "use step";
  await setStep(jobId, "pilot", "in-progress");

  // Decide renderer tier ahead of first /p/[id] hit so the rep page can show
  // the right badge as soon as the job completes. This is a single BD call;
  // the result is cached on the Job.
  let tier: RendererTier = "template";
  let reason = "default";
  let htmlLength: number | undefined;
  let bodyTextLength: number | undefined;

  try {
    const assessment = await assessProxyViability(url);
    if (assessment.status === "ok") {
      tier = "proxy";
      reason = `body ${assessment.bodyTextLength} chars, ${assessment.scriptCount} scripts`;
      htmlLength = assessment.htmlLength;
      bodyTextLength = assessment.bodyTextLength;
    } else {
      const tsx = await readComponent(jobId).catch(() => null);
      if (tsx) {
        tier = "claude";
        reason = `${assessment.reason} → using Claude`;
      } else {
        tier = "template";
        reason = `${assessment.reason} → no Claude component → using template`;
      }
      if (assessment.status === "sparse") {
        htmlLength = assessment.htmlLength;
        bodyTextLength = assessment.bodyTextLength;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[pilot] tier decision failed, defaulting to template:", message);
    reason = `tier decision threw: ${message} → using template`;
  }

  const pilotPath = `/p/${jobId}`;
  await updateJob(jobId, (job) => {
    job.pilotPath = pilotPath;
    job.renderer = {
      tier,
      reason,
      htmlLength,
      bodyTextLength,
      decidedAt: new Date().toISOString(),
    };
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
    await composeStep(jobId, url, analysed);
    await pilotStep(jobId, url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailureStep(jobId, message);
    throw err;
  }
}
