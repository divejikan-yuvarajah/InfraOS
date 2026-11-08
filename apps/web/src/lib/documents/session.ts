"use client";

import { useSyncExternalStore } from "react";

import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";

const useAuthPart = (read: () => string) => useSyncExternalStore(subscribeAuth, read, () => "");

/** Scope-defining identity parts for every DocTrace query key: a user or role switch can never read another user's cache. */
export function useDocKeys() {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  return { roleKey, userId, epoch, key: (...rest: (string | number | boolean | undefined)[]) => ["documents", epoch, userId, roleKey, ...rest] as const };
}

/** Role hints only choose what to render; the server is the authority and every action re-checks. */
export const hintUpload = (r: string): boolean => ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(r);
export const hintExport = (r: string): boolean => ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "CONTRACTOR", "INSPECTOR"].includes(r);
export const hintArchivedView = (r: string): boolean => ["GOV_ADMIN", "AGENCY_OFFICER"].includes(r);
