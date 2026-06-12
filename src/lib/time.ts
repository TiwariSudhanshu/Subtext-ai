/** seconds -> "MM:SS.mmm" (or "H:MM:SS.mmm" past an hour) for the editor UI. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sStr = s.toFixed(3).padStart(6, "0");
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${sStr}`
    : `${String(m).padStart(2, "0")}:${sStr}`;
}

/** Parse "MM:SS", "MM:SS.mmm", "H:MM:SS.mmm" or plain seconds. */
export function parseClock(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length > 3) return null;
  let seconds = 0;
  for (const part of parts) {
    const n = Number(part);
    if (Number.isNaN(n) || n < 0) return null;
    seconds = seconds * 60 + n;
  }
  return seconds;
}
