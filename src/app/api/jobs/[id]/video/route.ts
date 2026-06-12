import { readJob } from "@/lib/server/jobs";
import { jobPaths } from "@/lib/server/paths";
import { serveVideoFile } from "@/lib/server/stream";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Streams the original upload to the editor's <video> player. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const job = await readJob(id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  return serveVideoFile(req, jobPaths(id).input(job.ext));
}
