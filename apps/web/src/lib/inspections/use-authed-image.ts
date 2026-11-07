"use client";

import { useEffect, useRef, useState } from "react";

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

export type AuthedImage = { url: string | null; state: "idle" | "loading" | "ready" | "error"; ref: (el: Element | null) => void; retry: () => void };

/** Loads a protected image with the bearer token when the element nears the viewport. The server never exposes a public URL. */
export function useAuthedImage(evidenceId: string, variant: "thumb" | "full", eager = false): AuthedImage {
  const [state, setState] = useState<AuthedImage["state"]>(() => (cache.has(keyOf(evidenceId, variant)) ? "ready" : "idle"));
  const [url, setUrl] = useState<string | null>(() => cache.get(keyOf(evidenceId, variant)) ?? null);
  const [visible, setVisible] = useState(eager);
  const [attempt, setAttempt] = useState(0);
  const node = useRef<Element | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = (el: Element | null) => {
    observer.current?.disconnect();
    node.current = el;
    if (!el || eager || typeof IntersectionObserver === "undefined") { if (el) setVisible(true); return; }
    observer.current = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); observer.current?.disconnect(); } }, { rootMargin: "200px" });
    observer.current.observe(el);
  };

  useEffect(() => {
    const key = keyOf(evidenceId, variant);
    const cached = cache.get(key);
    if (cached) { queueMicrotask(() => { setUrl(cached); setState("ready"); }); return; }
    if (!visible) return;
    const controller = new AbortController();
    queueMicrotask(() => setState("loading"));
    fetchEvidenceBlob(evidenceId, variant, controller.signal)
      .then((blob) => { const u = URL.createObjectURL(blob); remember(key, u); setUrl(u); setState("ready"); })
      .catch((e: unknown) => { if ((e as { name?: string }).name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [evidenceId, variant, visible, attempt]);

  useEffect(() => () => observer.current?.disconnect(), []);
  return { url, state, ref, retry: () => { setState("idle"); setAttempt((n) => n + 1); } };
}
