import { notFound } from "next/navigation";
import { readJob } from "@/lib/jobs";
import { PilotTemplate } from "./pilot-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PilotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job || !job.practiceContext) notFound();
  return <PilotTemplate jobId={id} ctx={job.practiceContext} v0={job.v0} />;
}
