"use client";

import type { CaptionPosition, SubtitleStyle } from "@/lib/types";
import { FONT_OPTIONS } from "@/lib/subtitles/defaults";

interface StylePanelProps {
  style: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        checked
          ? "border-accent bg-accent/20 text-accent-2"
          : "border-edge text-gray-400 hover:bg-panel-2"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

const POSITIONS: CaptionPosition[] = ["top", "middle", "bottom"];

export function StylePanel({ style, onChange }: StylePanelProps) {
  const set = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) =>
    onChange({ ...style, [key]: value });

  return (
    <section className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-300">Caption style</h2>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
        <Field label="Font">
          <select
            value={style.fontFamily}
            onChange={(e) => set("fontFamily", e.target.value)}
            className="rounded-md border border-edge bg-panel-2 px-2 py-1.5 text-sm text-gray-200 focus:border-accent focus:outline-none"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Size — ${style.fontSizePct.toFixed(1)}%`}>
          <input
            type="range"
            min={2}
            max={10}
            step={0.1}
            value={style.fontSizePct}
            onChange={(e) => set("fontSizePct", Number(e.target.value))}
            className="mt-1.5"
          />
        </Field>

        <Field label="Text color">
          <input
            type="color"
            value={style.textColor}
            onChange={(e) => set("textColor", e.target.value)}
            className="h-8 w-full cursor-pointer"
          />
        </Field>

        <Field label="Position">
          <div className="flex gap-1">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => set("position", pos)}
                className={`flex-1 rounded-md border px-1 py-1.5 text-xs capitalize transition-colors ${
                  style.position === pos
                    ? "border-accent bg-accent/20 text-accent-2"
                    : "border-edge text-gray-400 hover:bg-panel-2"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Format">
          <div className="flex flex-wrap gap-1.5">
            <Toggle label="Bold" checked={style.bold} onChange={(v) => set("bold", v)} />
            <Toggle label="Italic" checked={style.italic} onChange={(v) => set("italic", v)} />
            <Toggle label="ABC" checked={style.uppercase} onChange={(v) => set("uppercase", v)} />
          </div>
        </Field>

        <Field label="Outline">
          <div className="flex items-center gap-2">
            <Toggle label="On" checked={style.outline} onChange={(v) => set("outline", v)} />
            {style.outline && (
              <input
                type="color"
                value={style.outlineColor}
                onChange={(e) => set("outlineColor", e.target.value)}
                className="h-7 w-10 cursor-pointer"
                aria-label="Outline color"
              />
            )}
          </div>
        </Field>

        <Field label="Background">
          <div className="flex items-center gap-2">
            <Toggle label="On" checked={style.box} onChange={(v) => set("box", v)} />
            {style.box && (
              <>
                <input
                  type="color"
                  value={style.boxColor}
                  onChange={(e) => set("boxColor", e.target.value)}
                  className="h-7 w-10 cursor-pointer"
                  aria-label="Background color"
                />
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={style.boxOpacity}
                  onChange={(e) => set("boxOpacity", Number(e.target.value))}
                  className="flex-1"
                  aria-label="Background opacity"
                />
              </>
            )}
          </div>
        </Field>

        <Field label="Word highlight">
          <div className="flex items-center gap-2">
            <Toggle
              label="Karaoke"
              checked={style.highlightMode === "color"}
              onChange={(v) => set("highlightMode", v ? "color" : "none")}
            />
            {style.highlightMode === "color" && (
              <input
                type="color"
                value={style.highlightColor}
                onChange={(e) => set("highlightColor", e.target.value)}
                className="h-7 w-10 cursor-pointer"
                aria-label="Highlight color"
              />
            )}
          </div>
        </Field>
      </div>
    </section>
  );
}
