import { Captions } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-accent/15 p-2.5 text-accent-2">
            <Captions size={30} strokeWidth={2.2} />
          </span>
          <h1 className="text-4xl font-bold tracking-tight">Subtext</h1>
        </div>
        <p className="max-w-xl text-balance text-lg text-gray-400">
          Upload a video, get an accurate AI transcript you can edit, then export
          subtitles as SRT/VTT — or burn styled captions straight onto the video.
        </p>
      </div>

      <UploadDropzone />

      <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-gray-500">
        <li>1. Upload</li>
        <li aria-hidden>→</li>
        <li>2. Auto-transcribe</li>
        <li aria-hidden>→</li>
        <li>3. Edit transcript &amp; style</li>
        <li aria-hidden>→</li>
        <li>4. Export SRT · VTT · video</li>
      </ol>
    </main>
  );
}
