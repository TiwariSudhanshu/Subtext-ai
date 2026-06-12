import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import type { VideoInfo } from "@/lib/types";

const FFMPEG = ffmpegPath ?? "ffmpeg";
const FFPROBE = ffprobeStatic.path ?? "ffprobe";

function run(
  bin: string,
  args: string[],
  opts: { cwd?: string; onStdoutLine?: (line: string) => void } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let lineBuffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (opts.onStdoutLine) {
        lineBuffer += text;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) opts.onStdoutLine(line);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      // Keep only the tail; ffmpeg stderr can be huge and errors print last.
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin.split(/[\\/]/).pop()} exited with code ${code}:\n${stderr.slice(-2_000)}`));
    });
  });
}

export async function probeVideo(inputPath: string): Promise<VideoInfo> {
  const { stdout } = await run(FFPROBE, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate",
    "-show_entries", "format=duration",
    "-of", "json",
    inputPath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0];
  if (!stream?.width || !stream?.height) {
    throw new Error("No video stream found in the uploaded file.");
  }
  const [num, den] = String(stream.r_frame_rate ?? "30/1").split("/").map(Number);
  return {
    width: stream.width,
    height: stream.height,
    duration: parseFloat(data.format?.duration ?? "0"),
    fps: den ? num / den : 30,
  };
}

/**
 * Extract mono 16 kHz MP3 for transcription. Whisper endpoints cap uploads at
 * 25 MB; 64 kbps mono keeps ~50 minutes of audio under that.
 */
export async function extractAudio(inputPath: string, audioPath: string): Promise<void> {
  await run(FFMPEG, [
    "-y", "-i", inputPath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-c:a", "libmp3lame",
    "-b:a", "64k",
    audioPath,
  ]);
}

/** Parse ffmpeg -progress "out_time=00:01:23.456000" into seconds. */
function parseOutTime(line: string): number | null {
  const match = line.match(/^out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/**
 * Burn the ASS subtitles onto the video. Runs with cwd = job dir and relative
 * filenames because ffmpeg filter arguments need brutal escaping for absolute
 * Windows paths (drive colons are filter option separators).
 */
export async function burnSubtitles(opts: {
  jobDir: string;
  inputName: string;
  assName: string;
  outputName: string;
  durationSeconds: number;
  onProgress: (fraction: number) => void;
}): Promise<void> {
  const { jobDir, inputName, assName, outputName, durationSeconds, onProgress } = opts;
  await run(
    FFMPEG,
    [
      "-y", "-i", inputName,
      // Even dimensions + yuv420p for maximum player compatibility.
      "-vf", `ass=${assName},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-progress", "pipe:1",
      "-nostats",
      outputName,
    ],
    {
      cwd: jobDir,
      onStdoutLine: (line) => {
        const seconds = parseOutTime(line);
        if (seconds !== null && durationSeconds > 0) {
          onProgress(Math.min(0.99, seconds / durationSeconds));
        }
      },
    },
  );
  onProgress(1);
}
