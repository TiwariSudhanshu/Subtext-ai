import path from "node:path";

/** All job artifacts live under storage/jobs/<id>/ — gitignored, no DB needed. */
export const STORAGE_ROOT = path.join(process.cwd(), "storage", "jobs");

export function jobDir(id: string): string {
  return path.join(STORAGE_ROOT, id);
}

export function jobPaths(id: string) {
  const dir = jobDir(id);
  return {
    dir,
    meta: path.join(dir, "job.json"),
    /** Stored input keeps its original extension so ffmpeg auto-detects format. */
    input: (ext: string) => path.join(dir, `input${ext}`),
    audio: path.join(dir, "audio.mp3"),
    ass: path.join(dir, "subs.ass"),
    output: path.join(dir, "output.mp4"),
  };
}

/** Guard against path traversal — job ids are UUIDs we generate. */
export function isSafeJobId(id: string): boolean {
  return /^[a-zA-Z0-9-]{8,64}$/.test(id);
}
