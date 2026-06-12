"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import type { JobMeta } from "@/lib/types";

const ACCEPT = ".mp4,.mov,.m4v,.webm,.mkv,.avi";

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    (file: File) => {
      setError(null);
      setProgress(0);

      // XHR instead of fetch for upload progress events.
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/upload?filename=${encodeURIComponent(file.name)}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText) as JobMeta & { error?: string };
          if (xhr.status >= 400 || data.error) {
            setError(data.error ?? `Upload failed (${xhr.status})`);
            setProgress(null);
          } else {
            router.push(`/edit/${data.id}`);
          }
        } catch {
          setError("Upload failed: unexpected server response.");
          setProgress(null);
        }
      };
      xhr.onerror = () => {
        setError("Upload failed: network error.");
        setProgress(null);
      };
      xhr.send(file);
    },
    [router],
  );

  const busy = progress !== null;

  return (
    <div className="w-full max-w-xl">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) upload(file);
        }}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 transition-colors ${
          dragging
            ? "border-accent bg-accent/10"
            : "border-edge bg-panel hover:border-accent/60 hover:bg-panel-2"
        } ${busy ? "pointer-events-none opacity-80" : ""}`}
      >
        {busy ? (
          <>
            <Loader2 size={32} className="animate-spin text-accent-2" />
            <p className="font-medium">
              Uploading… {Math.round((progress ?? 0) * 100)}%
            </p>
            <div className="h-1.5 w-64 overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${(progress ?? 0) * 100}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Upload size={32} className="text-accent-2" />
            <p className="text-lg font-medium">Drop a video here</p>
            <p className="text-sm text-gray-500">
              or click to browse — MP4, MOV, WebM, MKV, AVI
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="mt-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
