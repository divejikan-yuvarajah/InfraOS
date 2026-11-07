"use client";

import { useSyncExternalStore } from "react";

import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";

const useAuthPart = (read: () => string) => useSyncExternalStore(subscribeAuth, read, () => "");

/** Identity parts that scope every cached contractor query: a user or role switch can never read another user's cache. */
export function useContractorKeys() {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  return { roleKey, userId, epoch, key: (...rest: (string | number)[]) => ["contractors", epoch, userId, roleKey, ...rest] as const };
}
