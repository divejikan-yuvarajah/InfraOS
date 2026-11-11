"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { fetchAiStatusLite } from "@/lib/ai-admin/api";
import type { AiFeatureKey, AiStatusLiteDto, LiteFeatureStatus } from "@/lib/ai-admin/types";
import { hasAnyAiAccess } from "@/lib/ai-admin/view";
import {
  getAuthEpoch,
  getAuthSnapshot,
  getMemorySession,
  getServerAuthSnapshot,
  subscribeAuth,
} from "@/lib/auth/state";

export type AiStatusContextValue = {
  status: AiStatusLiteDto | null;
  overall: "available" | "degraded" | "unavailable";
  loading: boolean;
  canAccessAi: boolean;
  getFeatureStatus: (feature: AiFeatureKey) => LiteFeatureStatus;
  isFeatureEnabled: (feature: AiFeatureKey) => boolean;
  isFeatureAvailable: (feature: AiFeatureKey) => boolean;
  refetch: () => void;
};

const DEFAULT_VALUE: AiStatusContextValue = {
  status: null,
  overall: "unavailable",
  loading: false,
  canAccessAi: false,
  getFeatureStatus: () => "unavailable",
  isFeatureEnabled: () => false,
  isFeatureAvailable: () => false,
  refetch: () => undefined,
};

const AiStatusContext = createContext<AiStatusContextValue>(DEFAULT_VALUE);

function useAuthString(select: () => string): string {
  return useSyncExternalStore(subscribeAuth, select, () => "");
}

function useAuthEpoch(): number {
  return useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
}

export function AiStatusProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const snapshot = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);
  const epoch = useAuthEpoch();
  const userId = useAuthString(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthString(() => getMemorySession()?.user.roleKey ?? "");
  const canAccessAi = Boolean(
    snapshot.authenticated && snapshot.identityConfirmed && hasAnyAiAccess(roleKey),
  );

  const [isVisible, setIsVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      const visible = document.visibilityState !== "hidden";
      setIsVisible(visible);
      if (visible && canAccessAi) {
        void qc.invalidateQueries({ queryKey: ["ai", "status-lite", epoch, userId, roleKey] });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [canAccessAi, epoch, qc, roleKey, userId]);

  const query = useQuery({
    queryKey: ["ai", "status-lite", epoch, userId, roleKey],
    queryFn: ({ signal }) => fetchAiStatusLite(signal),
    enabled: canAccessAi,
    staleTime: 30_000,
    retry: false,
    refetchInterval: () => (canAccessAi && isVisible ? 60_000 : false),
  });

  const value = useMemo<AiStatusContextValue>(() => {
    const data = canAccessAi ? (query.data ?? null) : null;
    const loading = canAccessAi && query.isPending && !query.data;
    const overall: AiStatusContextValue["overall"] = !canAccessAi
      ? "unavailable"
      : data
        ? data.overall
        : query.isError
          ? "unavailable"
          : "degraded";

    const getFeatureStatus = (feature: AiFeatureKey): LiteFeatureStatus => {
      if (!canAccessAi) return "unavailable";
      if (data) return data.features[feature] ?? "unavailable";
      return query.isError ? "unavailable" : "degraded";
    };

    const isFeatureEnabled = (feature: AiFeatureKey): boolean => getFeatureStatus(feature) !== "disabled";
    const isFeatureAvailable = (feature: AiFeatureKey): boolean => {
      const state = getFeatureStatus(feature);
      return state === "available" || state === "degraded";
    };

    return {
      status: data,
      overall,
      loading,
      canAccessAi,
      getFeatureStatus,
      isFeatureEnabled,
      isFeatureAvailable,
      refetch: () => {
        if (canAccessAi) void query.refetch();
      },
    };
  }, [canAccessAi, query]);

  return <AiStatusContext.Provider value={value}>{children}</AiStatusContext.Provider>;
}

export function useAiStatus(): AiStatusContextValue {
  return useContext(AiStatusContext);
}

