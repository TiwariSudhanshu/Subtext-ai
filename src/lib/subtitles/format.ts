import type { Cue } from "@/lib/types";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** seconds -> "HH:MM:SS<sep>mmm" */
function formatTimestamp(seconds: number, msSeparator: string): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${msSeparator}${pad(ms, 3)}`;
}

export function toSrt(cues: Cue[]): string {
  return cues
    .map(
      (cue, i) =>
        `${i + 1}\n${formatTimestamp(cue.start, ",")} --> ${formatTimestamp(cue.end, ",")}\n${cue.text.trim()}\n`,
    )
    .join("\n");
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map(
      (cue) =>
        `${formatTimestamp(cue.start, ".")} --> ${formatTimestamp(cue.end, ".")}\n${cue.text.trim()}\n`,
    )
    .join("\n");
  return `WEBVTT\n\n${body}`;
}
