"use client";

import { useSyncExternalStore } from "react";

import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";

const useAuthPart = (read: () => string) => useSyncExternalStore(subscribeAuth, read, () => "");

/** Scope-defining identity parts for every asset query key: a user or role switch can never read another user's cache. */
export function useAssetKeys() {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  return { roleKey, userId, epoch, key: (...rest: (string | number | boolean | undefined)[]) => ["assets", epoch, userId, roleKey, ...rest] as const };
}

/** Role hints only choose what to render; the server is the authority and every action re-checks. */
export const hintConvert = (r: string): boolean => ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(r);
export const hintInsights = (r: string): boolean => ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(r);
