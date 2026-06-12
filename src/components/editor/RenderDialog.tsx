"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Download, Loader2, TriangleAlert, X } from "lucide-react";
import type { Cue, RenderState, SubtitleStyle } from "@/lib/types";

interface RenderDialogProps {
  jobId: string;
  cues: Cue[];
  style: SubtitleStyle;
  onClose: () => void;
}

/**
 * Kicks off the FFmpeg burn-in on the server and polls for progress until the
 * subtitled MP4 is ready to download.
 */
export function RenderDialog({ jobId, cues, style, onClose }: RenderDialogProps) {
  const [state, setState] = useState<RenderState>({ status: "rendering", progress: 0 });
  // Deduped across StrictMode's double-mounted effect: the POST fires once,
  // but every effect run awaits it, so the surviving run owns the poll loop.
  const postRef = useRef<Promise<Response> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/render`);
        const data = (await res.json()) as RenderState;
        if (cancelled) return;
        if (data.status === "idle") {
          // The server lost the in-memory render state (e.g. dev restart).
          setState({
            status: "error",
            progress: 0,
            error: "The render was interrupted — close this dialog and export again.",
          });
          return;
        }
        setState(data);
        if (data.status === "rendering") timer = setTimeout(poll, 600);
      } catch {
        if (!cancelled) timer = setTimeout(poll, 1500);
      }
    };

    postRef.current ??= fetch(`/api/jobs/${jobId}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cues, style }),
    });

    (async () => {
      try {
        const res = await postRef.current!;
        if (cancelled) return;
        if (!res.ok && res.status !== 409) {
          const data = (await res.clone().json()) as { error?: string };
          setState({ status: "error", progress: 0, error: data.error ?? "Render failed" });
          return;
        }
        // 409 = a render is already running; just attach to its progress.
        poll();
      } catch {
        if (!cancelled) {
          setState({ status: "error", progress: 0, error: "Could not reach the server." });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, cues, style]);

  const percent = Math.round(state.progress * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={state.status !== "rendering" ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-edge bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Export video</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-panel-2 hover:text-gray-300"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {state.status === "rendering" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-gray-300">
              <Loader2 size={18} className="animate-spin text-accent-2" />
              Burning captions onto the video… {percent}%
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Closing this dialog won&apos;t cancel the render — you can reopen it to
              check progress.
            </p>
          </div>
        )}

        {state.status === "done" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-400">
              <CircleCheck size={18} /> Your subtitled video is ready.
            </div>
            <a
              href={`/api/jobs/${jobId}/output?download=1&t=${state.finishedAt ?? ""}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:bg-accent-2"
            >
              <Download size={16} /> Download MP4
            </a>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 text-amber-400">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <span className="break-words text-sm">{state.error ?? "Render failed."}</span>
            </div>
            <button
              onClick={onClose}
              className="self-end rounded-lg border border-edge px-4 py-2 text-sm text-gray-300 hover:bg-panel-2"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
