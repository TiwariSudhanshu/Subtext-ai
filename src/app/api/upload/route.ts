import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { type NextRequest } from "next/server";
import { createJob, updateJob } from "@/lib/server/jobs";
import { probeVideo } from "@/lib/server/ffmpeg";
import { jobDir, jobPaths } from "@/lib/server/paths";

export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/**
 * The client POSTs the raw file body (not multipart) so we can stream it
 * straight to disk without buffering the whole video in memory.
 */
export async function POST(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get("filename") ?? "video.mp4";
  const ext = path.extname(fileName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return Response.json(
      { error: `Unsupported file type "${ext}". Use mp4, mov, m4v, webm, mkv or avi.` },
      { status: 400 },
    );
  }
  const declaredSize = Number(req.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "File too large (max 2 GB)." }, { status: 413 });
  }
  if (!req.body) {
    return Response.json({ error: "Empty request body." }, { status: 400 });
  }

  const job = await createJob(path.basename(fileName), ext);
  const inputPath = jobPaths(job.id).input(ext);

  try {
    await pipeline(
      Readable.fromWeb(req.body as unknown as import("node:stream/web").ReadableStream),
      createWriteStream(inputPath),
    );
    const video = await probeVideo(inputPath);
    const meta = await updateJob(job.id, { video });
    return Response.json(meta);
  } catch (err) {
    await rm(jobDir(job.id), { recursive: true, force: true });
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json(
      { error: `Could not read this file as a video. ${message}` },
      { status: 422 },
    );
  }
}
