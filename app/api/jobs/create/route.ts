import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { createJob } from "@/lib/jobs";
import { buildPilotWorkflow } from "@/workflow/build-pilot";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let url: string;
  try {
    const body = await req.json();
    url = String(body.url || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const job = await createJob(url);

  const run = await start(buildPilotWorkflow, [{ jobId: job.id, url }]);

  return NextResponse.json({ id: job.id, runId: run.runId });
}
