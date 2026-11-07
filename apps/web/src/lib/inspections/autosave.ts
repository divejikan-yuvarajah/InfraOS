/** Autosave policy and draft mirror helpers. Pure so the retry/backoff rules and the recovery decision can be tested. */
export const AUTOSAVE_DEBOUNCE_MS = 1500;
export const AUTOSAVE_MAX_TRIES = 6;
export const autosaveBackoffMs = (attempt: number): number => Math.min(30_000, 1500 * 2 ** Math.max(0, attempt - 1));

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "retrying" | "failed" | "conflict";

/** What to do after a failed save: wait and retry, give up for manual retry, or surface a revision conflict. */
export function afterFailure(status: number, attempt: number): { state: SaveState; retryInMs: number | null } {
  if (status === 409) return { state: "conflict", retryInMs: null };
  if (status === 400 || status === 403 || status === 404) return { state: "failed", retryInMs: null };
  if (attempt >= AUTOSAVE_MAX_TRIES) return { state: "failed", retryInMs: null };
  return { state: "retrying", retryInMs: autosaveBackoffMs(attempt) };
}

export type Mirror<T> = { v: 1; savedAt: number; baseRevision: number; draft: T };
export const mirrorKey = (inspectionId: string): string => `infraos.inspection.draft.v1.${inspectionId}`;

export function writeMirror<T>(storage: Pick<Storage, "setItem">, inspectionId: string, baseRevision: number, draft: T, now = Date.now()): void {
  try { storage.setItem(mirrorKey(inspectionId), JSON.stringify({ v: 1, savedAt: now, baseRevision, draft } satisfies Mirror<T>)); } catch { /* storage blocked or full: the server copy still saves */ }
}
export function readMirror<T>(storage: Pick<Storage, "getItem">, inspectionId: string): Mirror<T> | null {
  try {
    const raw = storage.getItem(mirrorKey(inspectionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Mirror<T>;
    return parsed && parsed.v === 1 && typeof parsed.baseRevision === "number" ? parsed : null;
  } catch { return null; }
}
export function clearMirror(storage: Pick<Storage, "removeItem">, inspectionId: string): void { try { storage.removeItem(mirrorKey(inspectionId)); } catch { /* ignore */ } }

/** Offer recovery only when the local mirror was based on the current server revision (or newer) and differs from the server copy. */
export function shouldOfferRecovery(mirror: Mirror<unknown> | null, serverRevision: number, differs: boolean): boolean {
  return Boolean(mirror) && differs && (mirror as Mirror<unknown>).baseRevision >= serverRevision;
}
