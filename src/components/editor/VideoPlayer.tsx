"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Cue, SubtitleStyle } from "@/lib/types";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Approximate libass glyph outline with stacked text shadows. */
function outlineShadow(width: number, color: string): string {
  const w = Math.max(1, width);
  const offsets = [
    [w, 0], [-w, 0], [0, w], [0, -w],
    [w, w], [-w, -w], [w, -w], [-w, w],
  ];
  return offsets.map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(", ");
}

interface VideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  cues: Cue[];
  style: SubtitleStyle;
  /** Coarse (~4 Hz) time updates for the transcript list. */
  onTimeUpdate: (seconds: number) => void;
}

/**
 * Video player with a CSS caption overlay that previews the burn-in styling.
 * The overlay tracks playback via requestAnimationFrame so word-level
 * highlight stays smooth (native timeupdate only fires ~4x per second).
 */
export function VideoPlayer({ videoRef, src, cues, style, onTimeUpdate }: VideoPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) setTime(video.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [videoRef]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver((entries) => {
      setVideoHeight(entries[0].contentRect.height);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const activeCue = cues.find((c) => time >= c.start && time <= c.end);
  let activeWordIndex = -1;
  if (activeCue && style.highlightMode === "color") {
    for (let i = activeCue.words.length - 1; i >= 0; i--) {
      if (time >= activeCue.words[i].start) {
        activeWordIndex = i;
        break;
      }
    }
  }

  const fontSize = (videoHeight * style.fontSizePct) / 100;
  const lineStyle: React.CSSProperties = {
    fontFamily: `'${style.fontFamily}', sans-serif`,
    fontSize: `${fontSize}px`,
    lineHeight: 1.25,
    color: style.textColor,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textTransform: style.uppercase ? "uppercase" : "none",
    textShadow: style.outline
      ? outlineShadow(fontSize * 0.05, style.outlineColor)
      : "none",
    ...(style.box
      ? {
          backgroundColor: hexToRgba(style.boxColor, style.boxOpacity),
          padding: "0.12em 0.3em",
          boxDecorationBreak: "clone" as const,
          WebkitBoxDecorationBreak: "clone" as const,
        }
      : {}),
  };

  const justify =
    style.position === "top" ? "flex-start" : style.position === "middle" ? "center" : "flex-end";

  return (
    <div className="flex items-start justify-center rounded-xl bg-black/40 p-3">
      <div ref={wrapperRef} className="relative inline-block">
        <video
          ref={videoRef}
          src={src}
          controls
          preload="metadata"
          className="block max-h-[62vh] max-w-full rounded-lg"
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        />
        {/* Caption preview — approximates the FFmpeg/libass burn-in result. */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center"
          style={{ justifyContent: justify, padding: "5% 4%" }}
        >
          {activeCue && (
            <p className="max-w-full text-center" style={lineStyle}>
              {style.highlightMode === "color" && activeCue.words.length > 0
                ? activeCue.words.map((word, i) => (
                    <span
                      key={i}
                      style={i === activeWordIndex ? { color: style.highlightColor } : undefined}
                    >
                      {word.text}
                      {i < activeCue.words.length - 1 ? " " : ""}
                    </span>
                  ))
                : activeCue.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
