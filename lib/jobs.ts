import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});
import type { PracticeContext } from "./practice-context";
import type { PracticeProfile } from "./profile-prospect";
import type { VisualTokens } from "./visual-tokens";

export type StepKey = "analyse" | "competitors" | "compose" | "pilot";
export type StepStatus = "pending" | "in-progress" | "complete" | "error";

export type JobStep = {
  key: StepKey;
  name: string;
  estimate: string;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export type BattleCard = {
  practiceSnapshot: string;
  websiteGapAnalysis: string;
  competitiveLandscape: { name: string; insight: string }[];
  chatbotPitch: string;
  estimatedImpact: string;
  openingLines: string[];
  fitSignal: { score: "strong" | "medium" | "weak"; rationale: string };
  lessonsFromPastProspects: string | null;
};

export type Job = {
  id: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  steps: JobStep[];
  profile?: PracticeProfile;
  visual?: VisualTokens;
  practiceContext?: PracticeContext;
  battleCard?: BattleCard;
  pilotPath?: string;
  componentBytes?: number;
  error?: string;
};

const JOB_TTL_SECONDS = 60 * 60 * 24 * 30;

const jobKey = (id: string) => `job:${id}`;

const defaultSteps = (): JobStep[] => [
  { key: "analyse", name: "Analysing the prospect", estimate: "~15s", status: "pending" },
  { key: "competitors", name: "Identifying competitors", estimate: "~25s", status: "pending" },
  { key: "compose", name: "Composing the pilot UI", estimate: "~25s", status: "pending" },
  { key: "pilot", name: "Building the pilot site", estimate: "~5s", status: "pending" },
];

async function writeJob(job: Job): Promise<void> {
  await kv.set(jobKey(job.id), job, { ex: JOB_TTL_SECONDS });
}

export async function createJob(url: string): Promise<Job> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: Job = {
    id,
    url,
    createdAt: now,
    updatedAt: now,
    steps: defaultSteps(),
  };
  await writeJob(job);
  return job;
}

export async function readJob(id: string): Promise<Job | null> {
  const job = await kv.get<Job>(jobKey(id));
  return job ?? null;
}

export async function updateJob(id: string, patch: (job: Job) => void | Promise<void>): Promise<Job> {
  const job = await readJob(id);
  if (!job) throw new Error(`Job ${id} not found`);
  await patch(job);
  job.updatedAt = new Date().toISOString();
  await writeJob(job);
  return job;
}

export async function setStep(
  id: string,
  key: StepKey,
  status: StepStatus,
  extra: Partial<JobStep> = {},
): Promise<void> {
  await updateJob(id, (job) => {
    const step = job.steps.find((s) => s.key === key);
    if (!step) return;
    step.status = status;
    if (status === "in-progress") step.startedAt = new Date().toISOString();
    if (status === "complete" || status === "error") step.finishedAt = new Date().toISOString();
    Object.assign(step, extra);
  });
}
