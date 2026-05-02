import { getRenderedPilot } from "@/lib/proxy-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const requestOrigin = `${url.protocol}//${url.host}`;
  const force = url.searchParams.get("refresh") === "1";
  const path = url.searchParams.get("path") ?? undefined;

  const { status, body, headers, tier } = await getRenderedPilot({
    jobId: id,
    requestOrigin,
    path,
    force,
  });
  const out = new Headers(headers as HeadersInit);
  if (tier) out.set("X-Mirror-Renderer", tier);
  return new Response(body, { status, headers: out });
}
