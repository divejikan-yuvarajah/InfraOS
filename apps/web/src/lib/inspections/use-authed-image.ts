"use client";

import { useEffect, useState } from "react";

import { fetchEvidenceBlob } from "./api";

/** Small in-memory blob cache so a thumbnail that scrolls out and back in is not downloaded again. URLs are revoked when evicted. */
const cache = new Map<string, string>();
const MAX_CACHE = 60;
const keyOf = (id: string, variant: string) => `${id}:${variant}`;

function remember(key: string, url: string): void {
  cache.set(key, url);
  if (cache.size > MAX_CACHE) { const oldest = cache.keys().next().value as string; URL.revokeObjectURL(cache.get(oldest)!); cache.delete(oldest); }
}
export function clearImageCache(): void { for (const url of cache.values()) URL.revokeObjectURL(url); cache.clear(); }

export type AuthedImage = { url: string | null; state: "idle" | "loading" | "ready" | "error"; retry: () => void };

/** Loads a protected image with the bearer token when the element nears the viewport. The server never exposes a public URL. */
export function useAuthedImage(evidenceId: string, variant: "thumb" | "full", eager: boolean, node: Element | null): AuthedImage {
  const key = keyOf(evidenceId, variant);
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [visible, setVisible] = useState(eager);
  const [attempt, setAttempt] = useState(0);

  // Observe the element and flip `visible` once it is within 200 px of the viewport.
  useEffect(() => {
    if (eager || visible || !node) return;
    if (typeof IntersectionObserver === "undefined") { queueMicrotask(() => setVisible(true)); return; }
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, eager, visible]);

  useEffect(() => {
    if (cache.has(key) || !visible) return;
    const controller = new AbortController();
    fetchEvidenceBlob(evidenceId, variant, controller.signal)
      .then((blob) => { const u = URL.createObjectURL(blob); remember(key, u); setFailed(null); setLoaded({ key, url: u }); })
      .catch((e: unknown) => { if ((e as { name?: string }).name !== "AbortError") setFailed(key); });
    return () => controller.abort();
  }, [evidenceId, variant, key, visible, attempt]);

  const url = cache.get(key) ?? (loaded?.key === key ? loaded.url : null);
  const state: AuthedImage["state"] = url ? "ready" : failed === key ? "error" : visible ? "loading" : "idle";
  return { url, state, retry: () => { setFailed(null); setAttempt((n) => n + 1); } };
}
