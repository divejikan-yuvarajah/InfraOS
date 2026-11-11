import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type {
  CopilotSuggestionDto,
  CopilotThreadSummaryDto,
  CopilotTurnDto,
  CopilotTurnStatus,
  CreateCopilotTurnPayload,
  QuickFactsDto,
  SubmitCopilotFeedbackPayload,
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
  method: "GET" | "POST" | "DELETE",
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

type Q = Record<string, string | undefined>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const createCopilotTurn = (payload: CreateCopilotTurnPayload) =>
  call<{ turnId: string; threadId: string; status: CopilotTurnStatus }>(
    "POST",
    "/ai/copilot/turns",
    payload,
  );

export const fetchCopilotTurn = (turnId: string, signal?: AbortSignal) =>
  call<CopilotTurnDto>("GET", `/ai/copilot/turns/${turnId}`, undefined, signal);

export const cancelCopilotTurn = (turnId: string) =>
  call<{ cancelled: boolean }>("POST", `/ai/copilot/turns/${turnId}/cancel`, {});

export const submitCopilotFeedback = (turnId: string, payload: SubmitCopilotFeedbackPayload) =>
  call<{ saved: boolean }>("POST", `/ai/copilot/turns/${turnId}/feedback`, payload);

export const fetchQuickFacts = (projectId?: string, signal?: AbortSignal) =>
  call<QuickFactsDto>("GET", `/ai/copilot/quick-facts${qs({ projectId })}`, undefined, signal);

export const fetchCopilotSuggestions = (
  pageType?: string,
  recordId?: string,
  signal?: AbortSignal,
) =>
  call<{ suggestions: CopilotSuggestionDto[] }>(
    "GET",
    `/ai/copilot/suggestions${qs({ pageType, recordId })}`,
    undefined,
    signal,
  );

export const fetchCopilotThreads = (signal?: AbortSignal) =>
  call<{ threads: CopilotThreadSummaryDto[] }>("GET", "/ai/copilot/threads", undefined, signal);

export const fetchCopilotThread = (threadId: string, signal?: AbortSignal) =>
  call<{ threadId: string; turns: CopilotTurnDto[] }>(
    "GET",
    `/ai/copilot/threads/${threadId}`,
    undefined,
    signal,
  );

export const deleteCopilotThread = (threadId: string) =>
  call<{ deleted: boolean }>("DELETE", `/ai/copilot/threads/${threadId}`);

