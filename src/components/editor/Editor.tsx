"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Captions, Download, Film, Loader2, TriangleAlert } from "lucide-react";
import type { Cue, JobMeta, SubtitleStyle } from "@/lib/types";
import { DEFAULT_STYLE } from "@/lib/subtitles/defaults";
import { cueFromText, redistributeWords } from "@/lib/subtitles/cues";
import { toSrt, toVtt } from "@/lib/subtitles/format";
import { downloadText } from "@/lib/download";
import { VideoPlayer } from "./VideoPlayer";
import { CueList } from "./CueList";
import { StylePanel } from "./StylePanel";
import { RenderDialog } from "./RenderDialog";

type Phase = "loading" | "transcribing" | "ready" | "error";

export function Editor({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobMeta | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [currentTime, setCurrentTime] = useState(0);
  const [renderOpen, setRenderOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hydratedRef = useRef(false);

  const applyReadyJob = useCallback((meta: JobMeta) => {
    setJob(meta);
    setCues(meta.cues ?? []);
    setStyle(meta.style ?? DEFAULT_STYLE);
    setPhase("ready");
  }, []);

  const startTranscription = useCallback(async () => {
    setPhase("transcribing");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/transcribe`, { method: "POST" });
      const data = (await res.json()) as JobMeta & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Transcription failed (${res.status})`);
      applyReadyJob(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Transcription failed");
      setPhase("error");
    }
  }, [jobId, applyReadyJob]);

  // Initial load: fetch the job, then transcribe / resume / hydrate as needed.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const pollWhileTranscribing = async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (cancelled) return;
      const data = (await res.json()) as JobMeta;
      if (data.status === "transcribing") {
        pollTimer = setTimeout(pollWhileTranscribing, 2000);
      } else if (data.status === "ready") {
        applyReadyJob(data);
      } else {
        setErrorMsg(data.error ?? "Transcription failed");
        setPhase("error");
      }
    };

    (async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (cancelled) return;
      if (!res.ok) {
        setErrorMsg("This job doesn't exist. It may have been cleaned up.");
        setPhase("error");
        return;
      }
      const data = (await res.json()) as JobMeta;
      setJob(data);
      if (data.cues && data.cues.length > 0) {
        applyReadyJob(data);
      } else if (data.status === "transcribing") {
        setPhase("transcribing");
        pollWhileTranscribing();
      } else if (data.status === "error") {
        setErrorMsg(data.error ?? "Transcription failed");
        setPhase("error");
      } else {
        startTranscription();
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [jobId, applyReadyJob, startTranscription]);

  // Debounced autosave of transcript edits and style changes.
  useEffect(() => {
    if (phase !== "ready") return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cues, style }),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [cues, style, phase, jobId]);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = seconds + 0.001;
      setCurrentTime(seconds + 0.001);
    }
  }, []);

  const changeCueText = useCallback((id: string, text: string) => {
    setCues((prev) =>
      prev.map((cue) =>
        cue.id === id
          ? { ...cue, text, words: redistributeWords(text, cue.start, cue.end) }
          : cue,
      ),
    );
  }, []);

  const changeCueTime = useCallback((id: string, field: "start" | "end", value: number) => {
    setCues((prev) =>
      prev.map((cue) => {
        if (cue.id !== id) return cue;
        const start = field === "start" ? Math.max(0, value) : cue.start;
        let end = field === "end" ? Math.max(0, value) : cue.end;
        if (end <= start) end = start + 0.05;
        return { ...cue, start, end, words: redistributeWords(cue.text, start, end) };
      }),
    );
  }, []);

  const deleteCue = useCallback((id: string) => {
    setCues((prev) => prev.filter((cue) => cue.id !== id));
  }, []);

  const addCue = useCallback(() => {
    setCues((prev) => {
      const last = prev[prev.length - 1];
      const start = last ? last.end + 0.1 : 0;
      const duration = job?.video?.duration;
      const end = duration ? Math.min(start + 2, Math.max(duration, start + 0.5)) : start + 2;
      return [...prev, cueFromText("New caption", start, end)];
    });
  }, [job?.video?.duration]);

  const baseName = job ? job.fileName.replace(/\.[^.]+$/, "") : "subtitles";

  if (phase === "loading" || phase === "transcribing" || phase === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        {phase === "error" ? (
          <>
            <TriangleAlert size={36} className="text-amber-400" />
            <p className="max-w-lg text-center text-gray-300">{errorMsg}</p>
            <div className="flex gap-3">
              {job && (
                <button
                  onClick={startTranscription}
                  className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-2"
                >
                  Retry transcription
                </button>
              )}
              <Link
                href="/"
                className="rounded-lg border border-edge px-4 py-2 text-gray-300 hover:bg-panel-2"
              >
                Back to upload
              </Link>
            </div>
          </>
        ) : (
          <>
            <Loader2 size={36} className="animate-spin text-accent-2" />
            <p className="text-lg text-gray-300">
              {phase === "loading" ? "Loading project…" : "Transcribing audio…"}
            </p>
            {phase === "transcribing" && (
              <p className="text-sm text-gray-500">
                Extracting audio and running speech recognition. This usually takes a
                few seconds per minute of video.
              </p>
            )}
          </>
        )}
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-edge bg-panel px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <span className="rounded-lg bg-accent/15 p-1.5 text-accent-2">
            <Captions size={18} />
          </span>
          Subtext
        </Link>
        <span className="truncate text-sm text-gray-500" title={job?.fileName}>
          {job?.fileName}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => downloadText(toSrt(cues), `${baseName}.srt`, "application/x-subrip")}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-sm text-gray-200 hover:bg-panel-2"
          >
            <Download size={15} /> SRT
          </button>
          <button
            onClick={() => downloadText(toVtt(cues), `${baseName}.vtt`, "text/vtt")}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-sm text-gray-200 hover:bg-panel-2"
          >
            <Download size={15} /> VTT
          </button>
          <button
            onClick={() => setRenderOpen(true)}
            disabled={cues.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-2 disabled:opacity-50"
          >
            <Film size={15} /> Export video
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_400px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
          <VideoPlayer
            videoRef={videoRef}
            src={`/api/jobs/${jobId}/video`}
            cues={cues}
            style={style}
            onTimeUpdate={setCurrentTime}
          />
          <StylePanel style={style} onChange={setStyle} />
        </div>

        <aside className="flex min-h-0 flex-col border-t border-edge bg-panel lg:border-l lg:border-t-0">
          <CueList
            cues={cues}
            currentTime={currentTime}
            onSeek={seekTo}
            onChangeText={changeCueText}
            onChangeTime={changeCueTime}
            onDelete={deleteCue}
            onAdd={addCue}
          />
        </aside>
      </div>

      {renderOpen && (
        <RenderDialog
          jobId={jobId}
          cues={cues}
          style={style}
          onClose={() => setRenderOpen(false)}
        />
      )}
    </main>
  );
}
