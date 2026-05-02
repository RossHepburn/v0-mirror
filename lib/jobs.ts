import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { PracticeContext } from "./practice-context";
import type { PracticeProfile } from "./profile-prospect";
import type { VisualTokens } from "./visual-tokens";

export type StepKey = "analyse" | "competitors" | "pilot";
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
  error?: string;
};

const JOBS_DIR = path.join(os.tmpdir(), "mirror-jobs");

async function ensureDir() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
}

function jobPath(id: string) {
  return path.join(JOBS_DIR, `${id}.json`);
}

const defaultSteps = (): JobStep[] => [
  { key: "analyse", name: "Analysing the prospect", estimate: "~15s", status: "pending" },
  { key: "competitors", name: "Identifying competitors", estimate: "~25s", status: "pending" },
  { key: "pilot", name: "Building the pilot site", estimate: "~30s", status: "pending" },
];

export async function createJob(url: string): Promise<Job> {
  await ensureDir();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: Job = {
    id,
    url,
    createdAt: now,
    updatedAt: now,
    steps: defaultSteps(),
  };
  await fs.writeFile(jobPath(id), JSON.stringify(job, null, 2));
  return job;
}

export async function readJob(id: string): Promise<Job | null> {
  try {
    const raw = await fs.readFile(jobPath(id), "utf8");
    return JSON.parse(raw) as Job;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function updateJob(id: string, patch: (job: Job) => void | Promise<void>): Promise<Job> {
  const job = await readJob(id);
  if (!job) throw new Error(`Job ${id} not found`);
  await patch(job);
  job.updatedAt = new Date().toISOString();
  await fs.writeFile(jobPath(id), JSON.stringify(job, null, 2));
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
