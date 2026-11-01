import { apiClient } from "@/lib/api/client";

import { guard, moved, type Envelope } from "./api";
import type { AssessmentResult, Band, RulesSummary, WhatIfResult } from "./assessment";

const base = (id: string) => `/api/v1/roadsync/work-requests/${encodeURIComponent(id)}/assessment`;

async function call<T>(path: string, init: { method: "GET" | "POST" | "DELETE"; body?: unknown }): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<T>>(path, { method: init.method, authenticated: true, ...(init.body !== undefined ? { body: init.body } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

/** First 50 assessed pairs of every kind plus whole-request counts. Filters and sorting happen client-side. */
export const fetchAssessment = (id: string) => call<AssessmentResult>(`${base(id)}?onlyConflicts=false&kind=conflict,opportunity,advisory&limit=50&sort=severity`, { method: "GET" });
export const runAssessmentNow = (id: string) => call<{ state: string }>(`${base(id)}/run`, { method: "POST" });
export const fetchAssessmentMap = (id: string) => call<{ type: "FeatureCollection"; features: unknown[] }>(`${base(id)}/map`, { method: "GET" });
export const fetchWhatIf = (id: string, body: { shiftDays?: number; bufferMeters?: number; workingHours?: string; sweep?: boolean }) => call<WhatIfResult>(`${base(id)}/whatif`, { method: "POST", body });
export const fetchRules = () => call<RulesSummary>("/api/v1/roadsync/assessment/rules", { method: "GET" });
export const saveOverride = (candidateId: string, body: { band: Band; reason: string }) => call<{ candidateId: string; overridden: boolean }>(`/api/v1/roadsync/assessment/candidates/${encodeURIComponent(candidateId)}/override`, { method: "POST", body });
export const clearOverride = (candidateId: string) => call<{ candidateId: string; overridden: boolean }>(`/api/v1/roadsync/assessment/candidates/${encodeURIComponent(candidateId)}/override`, { method: "DELETE" });
