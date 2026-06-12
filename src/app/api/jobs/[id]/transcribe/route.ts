import { readJob, updateJob } from "@/lib/server/jobs";
import { extractAudio } from "@/lib/server/ffmpeg";
import { jobPaths } from "@/lib/server/paths";
import { getProvider, transcribeAudio } from "@/lib/server/transcribe";
import { buildCuesFromSegments, buildCuesFromWords } from "@/lib/subtitles/cues";
import { DEFAULT_STYLE } from "@/lib/subtitles/defaults";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  if (job.status === "transcribing") {
    return Response.json({ error: "Transcription already in progress" }, { status: 409 });
  }
  if (!getProvider()) {
    // Fail fast before the (potentially slow) audio extraction.
    return Response.json(
      {
        error:
          "No transcription API key configured. Set GROQ_API_KEY or OPENAI_API_KEY in .env.local (see .env.local.example).",
      },
      { status: 500 },
    );
  }

  await updateJob(id, { status: "transcribing", error: undefined });
  const paths = jobPaths(id);

  try {
    await extractAudio(paths.input(job.ext), paths.audio);
    const result = await transcribeAudio(paths.audio);

    const cues =
      result.words.length > 0
        ? buildCuesFromWords(result.words)
        : buildCuesFromSegments(result.segments);

    const meta = await updateJob(id, {
      status: "ready",
      cues,
      style: job.style ?? DEFAULT_STYLE,
    });
    return Response.json(meta);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    await updateJob(id, { status: "error", error: message });
    return Response.json({ error: message }, { status: 500 });
  }
}
