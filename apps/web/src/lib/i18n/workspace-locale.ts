"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { AuthLocale } from "@/lib/auth/types";

/**
 * Staff-workspace view language, shared by the shell and every page and kept across
 * navigation. It is a display preference only: no token, identity or scope is stored here.
 */

export const WORKSPACE_LOCALES = ["en", "si", "ta"] as const satisfies readonly AuthLocale[];
const KEY = "infraos.workspace.locale";
const listeners = new Set<() => void>();
let memory: AuthLocale = "en";
let loaded = false;

export function parseWorkspaceLocale(value: unknown): AuthLocale {
  return typeof value === "string" && (WORKSPACE_LOCALES as readonly string[]).includes(value) ? (value as AuthLocale) : "en";
}

function read(): AuthLocale {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      memory = parseWorkspaceLocale(window.localStorage.getItem(KEY));
    } catch {
      memory = "en";
    }
  }
  return memory;
}

export function setWorkspaceLocale(next: AuthLocale): void {
  memory = parseWorkspaceLocale(next);
  loaded = true;
  try {
    window.localStorage.setItem(KEY, memory);
  } catch {
    // Storage blocked: the choice still applies for this tab.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Drop-in replacement for `useState<AuthLocale>("en")`. The server render is always English. */
export function useWorkspaceLocale(): [AuthLocale, (next: AuthLocale) => void] {
  const locale = useSyncExternalStore(subscribe, read, () => "en" as AuthLocale);
  const set = useCallback((next: AuthLocale) => setWorkspaceLocale(next), []);
  // Keep the document language in step with the visible language so screen readers pick the right voice and hyphenation.
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return [locale, set];
}

export const LOCALE_SHORT: Record<AuthLocale, string> = { en: "EN", si: "සිංහල", ta: "தமிழ்" };
export const LOCALE_NAME: Record<AuthLocale, string> = { en: "English", si: "සිංහල", ta: "தமிழ்" };
