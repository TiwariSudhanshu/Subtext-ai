import type { SubtitleStyle } from "@/lib/types";

/**
 * Fonts offered in the style panel. These must exist on the machine that runs
 * the FFmpeg burn-in (libass resolves them through the OS font system), and
 * are common enough to render acceptably in the browser preview too.
 */
export const FONT_OPTIONS = [
  "Arial",
  "Arial Black",
  "Impact",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
  "Comic Sans MS",
] as const;

export const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: "Arial",
  fontSizePct: 4.5,
  textColor: "#ffffff",
  bold: true,
  italic: false,
  uppercase: false,
  outline: true,
  outlineColor: "#000000",
  box: false,
  boxColor: "#000000",
  boxOpacity: 0.6,
  position: "bottom",
  highlightMode: "none",
  highlightColor: "#facc15",
};
