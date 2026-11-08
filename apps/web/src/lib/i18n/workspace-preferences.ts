"use client";

import { useSyncExternalStore } from "react";

export type WorkspaceDensity = "standard" | "dense";

const DENSITY_KEY = "infraos.workspace.density";
const REDUCED_MOTION_KEY = "infraos.workspace.reducedMotion";
const EVENT = "infraos:workspace-prefs";

function readDensity(): WorkspaceDensity {
  if (typeof window === "undefined") return "standard";
  try {
    const v = window.localStorage.getItem(DENSITY_KEY);
    if (v === "dense" || v === "standard") return v;
  } catch {
    /* private mode or blocked storage */
  }
  return "standard";
}

function readReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REDUCED_MOTION_KEY) === "true";
  } catch {
    return false;
  }
}

export function setWorkspaceDensity(next: WorkspaceDensity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DENSITY_KEY, next);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function setWorkspaceReducedMotion(next: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REDUCED_MOTION_KEY, next ? "true" : "false");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === DENSITY_KEY || e.key === REDUCED_MOTION_KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWorkspaceDensity(): [WorkspaceDensity, (next: WorkspaceDensity) => void] {
  const density = useSyncExternalStore<WorkspaceDensity>(subscribe, readDensity, () => "standard");
  return [density, setWorkspaceDensity];
}

export function useWorkspaceReducedMotion(): [boolean, (next: boolean) => void] {
  const reduced = useSyncExternalStore(subscribe, readReducedMotion, () => false);
  return [reduced, setWorkspaceReducedMotion];
}

