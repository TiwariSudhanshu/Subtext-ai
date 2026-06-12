/** A single transcribed word with timing in seconds. */
export interface Word {
  text: string;
  start: number;
  end: number;
}

/** One subtitle cue (a line/block shown on screen for a time range). */
export interface Cue {
  id: string;
  start: number;
  end: number;
  text: string;
  /** Word-level timings inside this cue; drives karaoke highlight. */
  words: Word[];
}

export type CaptionPosition = "top" | "middle" | "bottom";
export type HighlightMode = "none" | "color";

export interface SubtitleStyle {
  fontFamily: string;
  /** Font size as a percentage of video height (e.g. 4.5). */
  fontSizePct: number;
  textColor: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  outline: boolean;
  outlineColor: string;
  /** Background box behind each line. */
  box: boolean;
  boxColor: string;
  /** 0 (transparent) .. 1 (opaque) */
  boxOpacity: number;
  position: CaptionPosition;
  highlightMode: HighlightMode;
  highlightColor: string;
}

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  fps: number;
}

export type JobStatus = "uploaded" | "transcribing" | "ready" | "error";

export interface JobMeta {
  id: string;
  fileName: string;
  /** Extension of the stored input file, including the dot (".mp4"). */
  ext: string;
  createdAt: number;
  status: JobStatus;
  error?: string;
  video?: VideoInfo;
  cues?: Cue[];
  style?: SubtitleStyle;
}

export type RenderStatus = "idle" | "rendering" | "done" | "error";

export interface RenderState {
  status: RenderStatus;
  /** 0..1 */
  progress: number;
  error?: string;
  /** Timestamp of the last completed render, used to bust download caches. */
  finishedAt?: number;
}
