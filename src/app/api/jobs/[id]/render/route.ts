import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readJob, updateJob } from "@/lib/server/jobs";
import { burnSubtitles } from "@/lib/server/ffmpeg";
import { jobPaths } from "@/lib/server/paths";
import { getRenderState, setRenderState } from "@/lib/server/renders";
import { buildAss } from "@/lib/subtitles/ass";
import type { Cue, SubtitleStyle } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Poll render progress. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return Response.json(getRenderState(id));
}

/**
 * Start a burn-in render. Saves the latest cues/style, writes the .ass file,
 * then runs ffmpeg in the background while the client polls GET for progress.
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  if (!job.video) return Response.json({ error: "Video not analyzed yet" }, { status: 409 });
  if (getRenderState(id).status === "rendering") {
    return Response.json({ error: "A render is already running" }, { status: 409 });
  }

  const body = (await req.json()) as { cues: Cue[]; style: SubtitleStyle };
  if (!Array.isArray(body.cues) || body.cues.length === 0) {
    return Response.json({ error: "No subtitle cues to render" }, { status: 400 });
  }

  await updateJob(id, { cues: body.cues, style: body.style });

  const paths = jobPaths(id);
  const ass = buildAss(body.cues, body.style, job.video.width, job.video.height);
  await writeFile(paths.ass, ass, "utf8");

  setRenderState(id, { status: "rendering", progress: 0 });

  const duration = job.video.duration;
  // Fire-and-forget: progress is reported via the in-memory render store.
  void burnSubtitles({
    jobDir: paths.dir,
    inputName: path.basename(paths.input(job.ext)),
    assName: path.basename(paths.ass),
    outputName: path.basename(paths.output),
    durationSeconds: duration,
    onProgress: (fraction) => {
      if (getRenderState(id).status === "rendering") {
        setRenderState(id, { status: "rendering", progress: fraction });
      }
    },
  })
    .then(() => setRenderState(id, { status: "done", progress: 1, finishedAt: Date.now() }))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Render failed";
      setRenderState(id, { status: "error", progress: 0, error: message });
    });

  return Response.json({ started: true }, { status: 202 });
}
