import { NextResponse } from "next/server";
import { readJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job || !job.practiceContext) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const res = NextResponse.json({
    name: job.practiceContext.name,
    practiceContext: job.practiceContext,
  });
  res.headers.set("Cache-Control", "private, max-age=60");
  return res;
}
