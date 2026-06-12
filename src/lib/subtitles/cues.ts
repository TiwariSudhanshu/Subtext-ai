import type { Cue, Word } from "@/lib/types";

const MAX_CHARS_PER_CUE = 42;
const MAX_CUE_DURATION = 5;
/** A silence gap longer than this starts a new cue. */
const GAP_BREAK = 0.8;

function newId(): string {
  // crypto.randomUUID exists in modern browsers and Node 19+.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeCue(words: Word[]): Cue {
  return {
    id: newId(),
    start: words[0].start,
    end: words[words.length - 1].end,
    text: words.map((w) => w.text).join(" "),
    words,
  };
}

function endsSentence(word: string): boolean {
  return /[.!?。？！]["')\]]?$/.test(word);
}

/**
 * Group word-level timestamps into readable subtitle cues.
 * Breaks on sentence ends, long silences, max line length and max duration.
 */
export function buildCuesFromWords(words: Word[]): Cue[] {
  const cues: Cue[] = [];
  let current: Word[] = [];
  let chars = 0;

  for (const raw of words) {
    const text = raw.text.trim();
    if (!text) continue;
    const word: Word = { text, start: raw.start, end: raw.end };

    if (current.length > 0) {
      const prev = current[current.length - 1];
      const wouldExceedChars = chars + 1 + text.length > MAX_CHARS_PER_CUE;
      const wouldExceedDuration = word.end - current[0].start > MAX_CUE_DURATION;
      const longGap = word.start - prev.end > GAP_BREAK;
      const sentenceDone = endsSentence(prev.text) && chars >= 12;

      if (wouldExceedChars || wouldExceedDuration || longGap || sentenceDone) {
        cues.push(makeCue(current));
        current = [];
        chars = 0;
      }
    }

    current.push(word);
    chars += (chars > 0 ? 1 : 0) + text.length;
  }

  if (current.length > 0) cues.push(makeCue(current));
  return cues;
}

/**
 * After the user edits a cue's text, the original word timings no longer
 * match. Re-split the new text into words and spread them across the cue's
 * time range, weighted by word length, so highlight mode stays usable.
 */
export function redistributeWords(text: string, start: number, end: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const duration = Math.max(0.01, end - start);
  const totalWeight = tokens.reduce((sum, t) => sum + t.length + 1, 0);

  const words: Word[] = [];
  let cursor = start;
  for (const token of tokens) {
    const slice = ((token.length + 1) / totalWeight) * duration;
    words.push({ text: token, start: cursor, end: Math.min(end, cursor + slice) });
    cursor += slice;
  }
  words[words.length - 1].end = end;
  return words;
}

/** Build a brand-new cue from plain text (used by "add cue"). */
export function cueFromText(text: string, start: number, end: number): Cue {
  return {
    id: newId(),
    start,
    end,
    text,
    words: redistributeWords(text, start, end),
  };
}

/**
 * Fallback when a provider returns no word granularity: synthesize word
 * timings inside each segment.
 */
export function buildCuesFromSegments(
  segments: { start: number; end: number; text: string }[],
): Cue[] {
  const words: Word[] = segments.flatMap((seg) =>
    redistributeWords(seg.text.trim(), seg.start, seg.end),
  );
  return buildCuesFromWords(words);
}
