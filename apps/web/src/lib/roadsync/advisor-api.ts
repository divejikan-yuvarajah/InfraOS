import { apiClient } from "@/lib/api/client";

import { guard, moved, type Envelope } from "./api";
import type { Advice, AdvisorStats, Cached, DismissReason, Handoff, HandoffTarget, Preview } from "./advisor";

const base = "/api/v1/roadsync";
type Method = "GET" | "POST";
async function call<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<T>>(path, { method, authenticated: true, ...(body !== undefined ? { body } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
const enc = encodeURIComponent;
export const fetchAdvice = (conflictId: string, refresh = false) => call<Advice>(`${base}/conflicts/${enc(conflictId)}/advisor${refresh ? "?refresh=true" : ""}`, "GET");
export const fetchRequestAdvice = (requestId: string, refresh = false) => call<Advice>(`${base}/work-requests/${enc(requestId)}/advisor${refresh ? "?refresh=true" : ""}`, "GET");
export const sendFeedback = (recNo: string, body: { planKey?: string | null; action: "helpful" | "not_helpful" | "dismissed" | "restored"; reasonCode?: DismissReason }) => call<{ recorded: boolean }>(`${base}/advisor/${enc(recNo)}/feedback`, "POST", body);
export const fetchHandoff = (recNo: string, planKey: string, target: HandoffTarget) => call<Handoff>(`${base}/advisor/${enc(recNo)}/plans/${enc(planKey)}/handoff?target=${target}`, "GET");
export const fetchCachedAdvisor = (conflictId: string) => call<Cached>(`${base}/conflicts/${enc(conflictId)}/advisor/cached`, "GET");
export const fetchAdvisorStats = () => call<AdvisorStats>(`${base}/advisor/stats`, "GET");
export const previewSchedule = (body: unknown) => call<Preview>(`${base}/advisor/schedule-preview`, "POST", body);
