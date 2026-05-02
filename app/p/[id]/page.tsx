import { notFound } from "next/navigation";
import { readJob } from "@/lib/jobs";
import { readComponent } from "@/lib/compose";
import { PilotTemplate } from "./pilot-template";
import { SandboxRenderer } from "@/components/pilot/SandboxRenderer";

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
  const tsx = await readComponent(id);
  if (tsx) {
    return <SandboxRenderer jobId={id} ctx={job.practiceContext} tsx={tsx} />;
  }
  return <PilotTemplate jobId={id} ctx={job.practiceContext} />;
}
