"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Cue } from "@/lib/types";
import { formatClock, parseClock } from "@/lib/time";

interface CueListProps {
  cues: Cue[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  onChangeText: (id: string, text: string) => void;
  onChangeTime: (id: string, field: "start" | "end", value: number) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

function TimeField({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (seconds: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) {
      const parsed = parseClock(draft);
      if (parsed !== null && parsed !== value) onCommit(parsed);
    }
    setDraft(null);
  };

  return (
    <input
      value={draft ?? formatClock(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-[88px] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs tabular-nums text-gray-400 hover:border-edge focus:border-accent focus:text-gray-200 focus:outline-none"
      aria-label="Cue time"
    />
  );
}

export function CueList({
  cues,
  currentTime,
  onSeek,
  onChangeText,
  onChangeTime,
  onDelete,
  onAdd,
}: CueListProps) {
  const activeCue = cues.find((c) => currentTime >= c.start && currentTime <= c.end);
  const activeRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the playing cue visible without fighting the user's scrolling:
  // only auto-scroll when no input inside the list is focused.
  useEffect(() => {
    const active = activeRef.current;
    const list = listRef.current;
    if (!active || !list) return;
    if (list.contains(document.activeElement)) return;
    active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeCue?.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-300">
          Transcript
          <span className="ml-2 font-normal text-gray-500">{cues.length} cues</span>
        </h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 rounded-md border border-edge px-2 py-1 text-xs text-gray-300 hover:bg-panel-2"
        >
          <Plus size={13} /> Add cue
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {cues.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-500">
            No cues. The transcription came back empty — add cues manually or retry.
          </p>
        )}
        {cues.map((cue) => {
          const isActive = cue.id === activeCue?.id;
          return (
            <div
              key={cue.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSeek(cue.start)}
              className={`group cursor-pointer border-b border-edge/60 px-4 py-2.5 transition-colors ${
                isActive ? "bg-accent/10" : "hover:bg-panel-2"
              }`}
            >
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <TimeField value={cue.start} onCommit={(s) => onChangeTime(cue.id, "start", s)} />
                <span aria-hidden>→</span>
                <TimeField value={cue.end} onCommit={(s) => onChangeTime(cue.id, "end", s)} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(cue.id);
                  }}
                  className="ml-auto rounded p-1 text-gray-600 opacity-0 transition-opacity hover:bg-red-950 hover:text-red-400 group-hover:opacity-100"
                  aria-label="Delete cue"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                value={cue.text}
                rows={Math.max(1, Math.ceil(cue.text.length / 46))}
                onChange={(e) => onChangeText(cue.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className={`mt-1 w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-sm leading-snug focus:border-accent focus:outline-none ${
                  isActive ? "text-white" : "text-gray-300"
                }`}
                aria-label="Cue text"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
