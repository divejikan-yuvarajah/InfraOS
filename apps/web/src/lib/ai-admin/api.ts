import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";
import { getPublicApiBaseUrl } from "@/lib/env/public";

import type {
  AboutAiDto,
  AiAuditPageDto,
  AiAuditQuery,
  AiLimitsMeDto,
  AiSettingsDto,
  AiSettingsResponseDto,
  AiStatusLiteDto,
  AiUsageAgencyDto,
  AiUsageMeDto,
  ModelsCheckProbeDto,
  UpdateAiSettingsPayload,
} from "./types";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

function moved(atEpoch: number, tokenAtStart: string) {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
}

async function call<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ data: T }>(`/api/v1${path}`, {
    method,
    authenticated: true,
    ...(body !== undefined ? { body } : {}),
    ...(signal ? { signal } : {}),
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fetchAiStatusLite = (signal?: AbortSignal) =>
  call<AiStatusLiteDto>("GET", "/ai/status/lite", undefined, signal);

export const fetchMyAiLimits = (signal?: AbortSignal) =>
  call<AiLimitsMeDto>("GET", "/ai/limits/me", undefined, signal);

export const fetchMyAiUsage = (signal?: AbortSignal) =>
  call<AiUsageMeDto>("GET", "/ai/usage/me", undefined, signal);

export const fetchAgencyAiUsage = (
  params: { from?: string; to?: string; feature?: string; agencyId?: string },
  signal?: AbortSignal,
) => call<AiUsageAgencyDto>("GET", `/ai/usage/agency${qs(params)}`, undefined, signal);

export const fetchAiAudit = (query: AiAuditQuery, signal?: AbortSignal) =>
  call<AiAuditPageDto>("GET", `/ai/audit${qs(query)}`, undefined, signal);

export async function downloadAiAuditCsv(query: Omit<AiAuditQuery, "cursor" | "limit">): Promise<void> {
  const { atEpoch, tokenAtStart } = guard();
  const res = await fetch(`${getPublicApiBaseUrl()}/api/v1/ai/audit/export.csv${qs(query)}`, {
    headers: { Authorization: `Bearer ${tokenAtStart}`, Accept: "text/csv" },
    credentials: "omit",
  });
  moved(atEpoch, tokenAtStart);
  if (!res.ok) throw new ApiError("export failed", res.status);
  saveBlob(await res.blob(), `ai-audit-${new Date().toISOString().slice(0, 10)}.csv`);
}

export const fetchAiSettings = (agencyId?: string, signal?: AbortSignal) =>
  call<AiSettingsResponseDto>("GET", `/ai/settings${qs({ agencyId })}`, undefined, signal);

export const updateAiSettings = (payload: UpdateAiSettingsPayload) =>
  call<AiSettingsDto>("PUT", "/ai/settings", payload);

export const updateAgencyAiSettings = (agencyId: string, payload: UpdateAiSettingsPayload) =>
  call<AiSettingsDto>("PUT", `/ai/settings/agency/${agencyId}`, payload);

export const resetAiSettings = (payload: { scope?: "PLATFORM" | "AGENCY"; agencyId?: string }) =>
  call<AiSettingsDto>("POST", "/ai/settings/reset", payload);

export const probeAiModels = () =>
  call<ModelsCheckProbeDto>("POST", "/ai/models/check", {});

/** Public-to-authenticated endpoint: attaches Bearer header only when signed in. */
export async function fetchAboutAi(signal?: AbortSignal): Promise<AboutAiDto> {
  const token = getMemoryAccessToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getPublicApiBaseUrl()}/api/v1/ai/about`, {
    method: "GET",
    headers,
    credentials: "omit",
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    throw new ApiError("failed to load transparency summary", res.status);
  }
  const payload = (await res.json()) as { data: AboutAiDto };
  return payload.data;
}

