import path from "node:path";
import { type NextRequest } from "next/server";
import { readJob } from "@/lib/server/jobs";
import { jobPaths } from "@/lib/server/paths";
import { serveVideoFile } from "@/lib/server/stream";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Streams (or downloads, with ?download=1) the rendered burn-in video. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const wantsDownload = req.nextUrl.searchParams.get("download") === "1";
  const baseName = path.basename(job.fileName, path.extname(job.fileName));
  return serveVideoFile(req, jobPaths(id).output, {
    downloadName: wantsDownload ? `${baseName}-subtitled.mp4` : undefined,
  });
}
