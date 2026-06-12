import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { JobMeta } from "@/lib/types";
import { isSafeJobId, jobDir, jobPaths } from "./paths";

export async function createJob(fileName: string, ext: string): Promise<JobMeta> {
  const meta: JobMeta = {
    id: randomUUID(),
    fileName,
    ext,
    createdAt: Date.now(),
    status: "uploaded",
  };
  await mkdir(jobDir(meta.id), { recursive: true });
  await writeJob(meta);
  return meta;
}

export async function readJob(id: string): Promise<JobMeta | null> {
  if (!isSafeJobId(id)) return null;
  try {
    const raw = await readFile(jobPaths(id).meta, "utf8");
    return JSON.parse(raw) as JobMeta;
  } catch {
    return null;
  }
}

/** Write-then-rename so a crash mid-write never corrupts job.json. */
export async function writeJob(meta: JobMeta): Promise<void> {
  const target = jobPaths(meta.id).meta;
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(meta, null, 2), "utf8");
  await rename(tmp, target);
}

export async function updateJob(
  id: string,
  patch: Partial<JobMeta>,
): Promise<JobMeta | null> {
  const meta = await readJob(id);
  if (!meta) return null;
  const next = { ...meta, ...patch };
  await writeJob(next);
  return next;
}
