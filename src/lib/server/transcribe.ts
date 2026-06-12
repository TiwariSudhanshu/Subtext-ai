import { readFile, stat } from "node:fs/promises";
import type { Word } from "@/lib/types";

/**
 * Whisper transcription over OpenAI-compatible APIs. Groq and OpenAI share
 * the exact same request/response shape, so one client covers both; adding
 * another provider (or a local whisper server) is just another entry here.
 */

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // both providers cap at 25 MB

export interface TranscriptionProvider {
  name: string;
  url: string;
  model: string;
  apiKey: string;
}

export interface TranscriptionResult {
  text: string;
  words: Word[];
  segments: { start: number; end: number; text: string }[];
}

export function getProvider(): TranscriptionProvider | null {
  if (process.env.GROQ_API_KEY) {
    return {
      name: "Groq",
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      model: "whisper-large-v3-turbo",
      apiKey: process.env.GROQ_API_KEY,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      name: "OpenAI",
      // whisper-1 is the only OpenAI model with word-level timestamps.
      url: "https://api.openai.com/v1/audio/transcriptions",
      model: "whisper-1",
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  return null;
}

interface VerboseJsonResponse {
  text?: string;
  words?: { word: string; start: number; end: number }[];
  segments?: { start: number; end: number; text: string }[];
}

export async function transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No transcription API key configured. Set GROQ_API_KEY or OPENAI_API_KEY in .env.local (see .env.local.example).",
    );
  }

  const { size } = await stat(audioPath);
  if (size > MAX_AUDIO_BYTES) {
    throw new Error(
      "Extracted audio exceeds the 25 MB transcription limit (roughly 50 minutes). Try a shorter video.",
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(await readFile(audioPath))], { type: "audio/mpeg" }),
    "audio.mp3",
  );
  form.append("model", provider.model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch(provider.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${provider.name} transcription failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as VerboseJsonResponse;
  return {
    text: data.text ?? "",
    words: (data.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end })),
    segments: (data.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text })),
  };
}
