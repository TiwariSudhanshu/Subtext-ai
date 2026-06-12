import type { Cue, SubtitleStyle } from "@/lib/types";

/**
 * ASS (Advanced SubStation Alpha) generation for the FFmpeg/libass burn-in.
 * ASS is the only widely supported subtitle format with full styling control
 * (fonts, colors, outlines, boxes, positioning, per-word overrides), which is
 * why the burn-in pipeline goes style -> .ass -> ffmpeg `ass=` filter.
 */

/** "#rrggbb" + opacity -> ASS "&HAABBGGRR" (alpha 00 = opaque, FF = transparent). */
export function hexToAssColor(hex: string, opacity = 1): string {
  const clean = hex.replace("#", "");
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  const alpha = Math.round((1 - Math.min(1, Math.max(0, opacity))) * 255)
    .toString(16)
    .padStart(2, "0");
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

/** seconds -> "H:MM:SS.cc" */
function assTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Braces/backslashes would be parsed as ASS override tags — neutralize them. */
function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "/")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/\r?\n/g, "\\N");
}

const ALIGNMENT: Record<SubtitleStyle["position"], number> = {
  bottom: 2, // bottom center
  middle: 5, // middle center
  top: 8, // top center
};

interface DialogueEvent {
  start: number;
  end: number;
  text: string;
}

function eventsForCue(cue: Cue, style: SubtitleStyle): DialogueEvent[] {
  const transform = (t: string) => (style.uppercase ? t.toUpperCase() : t);

  if (style.highlightMode !== "color" || cue.words.length === 0) {
    return [{ start: cue.start, end: cue.end, text: escapeAssText(transform(cue.text)) }];
  }

  // Karaoke-style highlight: one event per word window, with the active word
  // recolored. Color-only (no bold/size change) keeps glyph metrics identical
  // so the line never shifts as the highlight moves.
  const highlight = hexToAssColor(style.highlightColor);
  const base = hexToAssColor(style.textColor);
  const words = cue.words.map((w) => ({ ...w, text: escapeAssText(transform(w.text)) }));
  const events: DialogueEvent[] = [];

  // If the cue starts noticeably before its first word, show the line
  // unhighlighted during that lead-in.
  const hasLeadGap = words[0].start - cue.start > 0.08;
  if (hasLeadGap) {
    events.push({
      start: cue.start,
      end: words[0].start,
      text: words.map((w) => w.text).join(" "),
    });
  }

  for (let i = 0; i < words.length; i++) {
    const start = i === 0 ? (hasLeadGap ? words[0].start : cue.start) : words[i].start;
    const end = i === words.length - 1 ? Math.max(cue.end, words[i].end) : words[i + 1].start;
    if (end - start < 0.001) continue;
    const text = words
      .map((w, j) => (j === i ? `{\\c${highlight}&}${w.text}{\\c${base}&}` : w.text))
      .join(" ");
    events.push({ start, end, text });
  }

  return events;
}

export function buildAss(
  cues: Cue[],
  style: SubtitleStyle,
  videoWidth: number,
  videoHeight: number,
): string {
  const fontSize = Math.max(8, Math.round((videoHeight * style.fontSizePct) / 100));
  const outlineWidth = style.outline ? Math.max(1, Math.round(fontSize * 0.05)) : 0;
  // BorderStyle 4 (libass extension): background box from BackColour while
  // still drawing the normal text outline. Box padding follows Outline width.
  const borderStyle = style.box ? 4 : 1;
  const boxPad = style.box ? Math.max(outlineWidth, Math.round(fontSize * 0.18)) : outlineWidth;

  const primary = hexToAssColor(style.textColor);
  const outline = hexToAssColor(style.outlineColor);
  const back = style.box ? hexToAssColor(style.boxColor, style.boxOpacity) : hexToAssColor("#000000", 0.5);

  const marginH = Math.round(videoWidth * 0.04);
  const marginV = Math.round(videoHeight * 0.05);

  const styleLine = [
    "Default",
    style.fontFamily,
    fontSize,
    primary,
    primary, // SecondaryColour (unused — we do per-word overrides, not \k)
    outline,
    back,
    style.bold ? -1 : 0,
    style.italic ? -1 : 0,
    0, // Underline
    0, // StrikeOut
    100, // ScaleX
    100, // ScaleY
    0, // Spacing
    0, // Angle
    borderStyle,
    style.box ? boxPad : outlineWidth,
    0, // Shadow
    ALIGNMENT[style.position],
    marginH,
    marginH,
    marginV,
    1, // Encoding
  ].join(",");

  const events = cues
    .flatMap((cue) => eventsForCue(cue, style))
    .filter((e) => e.end - e.start >= 0.001)
    .map((e) => `Dialogue: 0,${assTime(e.start)},${assTime(e.end)},Default,,0,0,0,,${e.text}`)
    .join("\n");

  return `[Script Info]
Title: Subtext captions
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${styleLine}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
}
