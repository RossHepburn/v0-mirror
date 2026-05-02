import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { runBuildPilot } from "@/lib/build-pilot";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  // Fire-and-forget the background work. The Next.js dev server keeps the
  // process alive; on Vercel we'd lift this onto Workflow/Inngest, but for
  // hackathon time pressure /tmp + an in-process promise is enough.
  runBuildPilot(job.id, url).catch((err) => {
    console.error(`[api/jobs/create] runBuildPilot crashed for ${job.id}:`, err);
  });

  return NextResponse.json({ id: job.id });
}
