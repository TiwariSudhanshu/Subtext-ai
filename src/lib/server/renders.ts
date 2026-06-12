import type { RenderState } from "@/lib/types";

/**
 * In-memory render progress, keyed by job id. Stored on globalThis so the
 * map survives Next.js dev-server module reloads between requests.
 */
const globalStore = globalThis as unknown as {
  __subtextRenders?: Map<string, RenderState>;
};

const renders: Map<string, RenderState> =
  globalStore.__subtextRenders ?? (globalStore.__subtextRenders = new Map());

export function getRenderState(jobId: string): RenderState {
  return renders.get(jobId) ?? { status: "idle", progress: 0 };
}

export function setRenderState(jobId: string, state: RenderState): void {
  renders.set(jobId, state);
}
