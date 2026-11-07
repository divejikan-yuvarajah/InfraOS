/**
 * Evidence upload queue as a small, framework-free state machine so retry, backoff and cancel are testable.
 * Each item: queued -> uploading -> done | failed. `failed` items stay visible and can be retried or removed.
 */
export type UploadState = "queued" | "uploading" | "done" | "failed" | "cancelled";
export type UploadItem<M = unknown> = { id: string; state: UploadState; progress: number; attempts: number; error: string | null; nextAt: number; meta: M };

export const MAX_ATTEMPTS = 4;
export const PARALLELISM = 2;
export const backoffMs = (attempt: number): number => Math.min(15_000, 1000 * 2 ** Math.max(0, attempt - 1));

export type Runner<M> = (item: UploadItem<M>, onProgress: (fraction: number) => void, signal: AbortSignal) => Promise<void>;
/** Return true when a failure is permanent (validation, conflict, duplicate) and must not be retried automatically. */
export type Permanent = (error: unknown) => boolean;

export class UploadQueue<M = unknown> {
  private items = new Map<string, UploadItem<M>>();
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: UploadItem<M>[] = [];

  constructor(private run: Runner<M>, private isPermanent: Permanent = () => false, private now: () => number = Date.now, private parallelism = PARALLELISM) {}

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = (): UploadItem<M>[] => this.snapshot;
  private emit(): void { this.snapshot = [...this.items.values()]; for (const l of this.listeners) l(); }

  add(id: string, meta: M): void {
    if (this.items.has(id)) return;
    this.items.set(id, { id, state: "queued", progress: 0, attempts: 0, error: null, nextAt: 0, meta });
    this.emit();
    this.pump();
  }
  retry(id: string): void {
    const it = this.items.get(id);
    if (!it || (it.state !== "failed" && it.state !== "cancelled")) return;
    this.items.set(id, { ...it, state: "queued", attempts: 0, error: null, nextAt: 0, progress: 0 });
    this.emit();
    this.pump();
  }
  cancel(id: string): void {
    const it = this.items.get(id);
    if (!it) return;
    this.controllers.get(id)?.abort();
    if (it.state === "queued" || it.state === "uploading") { this.items.set(id, { ...it, state: "cancelled" }); this.emit(); }
  }
  remove(id: string): void { this.cancel(id); this.items.delete(id); this.emit(); }
  clearDone(): void { for (const [id, it] of this.items) if (it.state === "done") this.items.delete(id); this.emit(); }
  hasPending(): boolean { return [...this.items.values()].some((i) => i.state === "queued" || i.state === "uploading"); }
  dispose(): void { if (this.timer) clearTimeout(this.timer); for (const c of this.controllers.values()) c.abort(); this.listeners.clear(); }

  private active = () => [...this.items.values()].filter((i) => i.state === "uploading").length;

  private pump(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const t = this.now();
    let nextWake = Infinity;
    for (const it of this.items.values()) {
      if (it.state !== "queued") continue;
      if (it.nextAt > t) { nextWake = Math.min(nextWake, it.nextAt); continue; }
      if (this.active() >= this.parallelism) break;
      void this.start(it.id);
    }
    if (Number.isFinite(nextWake)) this.timer = setTimeout(() => this.pump(), Math.max(0, nextWake - t));
  }

  private async start(id: string): Promise<void> {
    const it = this.items.get(id);
    if (!it || it.state !== "queued") return;
    const controller = new AbortController();
    this.controllers.set(id, controller);
    this.items.set(id, { ...it, state: "uploading", attempts: it.attempts + 1, progress: 0, error: null });
    this.emit();
    try {
      await this.run(this.items.get(id)!, (fraction) => { const cur = this.items.get(id); if (cur && cur.state === "uploading") { this.items.set(id, { ...cur, progress: fraction }); this.emit(); } }, controller.signal);
      const cur = this.items.get(id);
      if (cur && cur.state === "uploading") this.items.set(id, { ...cur, state: "done", progress: 1 });
    } catch (error) {
      const cur = this.items.get(id);
      if (cur && cur.state === "uploading") {
        const aborted = controller.signal.aborted;
        if (aborted) this.items.set(id, { ...cur, state: "cancelled" });
        else if (this.isPermanent(error) || cur.attempts >= MAX_ATTEMPTS) this.items.set(id, { ...cur, state: "failed", error: error instanceof Error ? error.message : "failed" });
        else this.items.set(id, { ...cur, state: "queued", nextAt: this.now() + backoffMs(cur.attempts), error: error instanceof Error ? error.message : "failed" });
      }
    } finally {
      this.controllers.delete(id);
      this.emit();
      this.pump();
    }
  }
}
