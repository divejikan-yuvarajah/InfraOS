import { createHash } from "node:crypto";

export function computeRequestFingerprint(userId: string, feature: string, payload: unknown): string {
  const norm = JSON.stringify(payload, Object.keys(payload as object || {}).sort());
  return createHash("sha256").update(`${userId}:${feature}:${norm}`).digest("hex");
}

type CachedEntry<T> = {
  result: T;
  expiresAt: number;
};

class RequestDedupeCache {
  private inFlight = new Map<string, Promise<any>>();
  private recent = new Map<string, CachedEntry<any>>();
  private readonly ttlMs: number;

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  getRecent<T>(fingerprint: string): T | undefined {
    const entry = this.recent.get(fingerprint);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.recent.delete(fingerprint);
      return undefined;
    }
    return entry.result as T;
  }

  setRecent<T>(fingerprint: string, result: T): void {
    this.recent.set(fingerprint, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  async runOrJoin<T>(fingerprint: string, execute: () => Promise<T>): Promise<T> {
    const cached = this.getRecent<T>(fingerprint);
    if (cached !== undefined) return cached;

    const existing = this.inFlight.get(fingerprint);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const res = await execute();
        this.setRecent(fingerprint, res);
        return res;
      } finally {
        this.inFlight.delete(fingerprint);
      }
    })();

    this.inFlight.set(fingerprint, promise);
    return promise;
  }
}

export const requestDedupeCache = new RequestDedupeCache();

