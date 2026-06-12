import { readJob, updateJob } from "@/lib/server/jobs";
import type { Cue, SubtitleStyle } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  return Response.json(job);
}

/** Autosave endpoint for transcript edits and style changes. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as { cues?: Cue[]; style?: SubtitleStyle };

  const patch: { cues?: Cue[]; style?: SubtitleStyle } = {};
  if (Array.isArray(body.cues)) patch.cues = body.cues;
  if (body.style && typeof body.style === "object") patch.style = body.style;

  const job = await updateJob(id, patch);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  return Response.json(job);
}
