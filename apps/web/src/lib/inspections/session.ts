"use client";

import { useSyncExternalStore } from "react";

import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";

const useAuthPart = (read: () => string) => useSyncExternalStore(subscribeAuth, read, () => "");

/** Scope-defining identity parts for every inspection query key: a user or role switch can never read another user's cache. */
export function useInspectionKeys() {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  return { roleKey, userId, epoch, key: (...rest: (string | number | boolean | undefined)[]) => ["inspections", epoch, userId, roleKey, ...rest] as const };
}

/** Role hints only choose what to render; the server is the authority. */
export const hintAssign = (roleKey: string): boolean => ["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(roleKey);
export const hintReview = (roleKey: string): boolean => ["GOV_ADMIN", "AGENCY_OFFICER", "INSPECTOR"].includes(roleKey);
export const isInspectorRole = (roleKey: string): boolean => roleKey === "INSPECTOR";
