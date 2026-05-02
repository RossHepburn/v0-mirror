import { NextResponse } from "next/server";
import { readJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const allComplete = job.steps.every((s) => s.status === "complete");
  const anyError = job.steps.some((s) => s.status === "error") || !!job.error;

  return NextResponse.json({
    id: job.id,
    url: job.url,
    steps: job.steps,
    practiceContext: job.practiceContext ?? null,
    battleCard: job.battleCard ?? null,
    pilotPath: job.pilotPath ?? null,
    allComplete,
    error: anyError ? job.error || job.steps.find((s) => s.error)?.error || "Job failed" : null,
  });
}
