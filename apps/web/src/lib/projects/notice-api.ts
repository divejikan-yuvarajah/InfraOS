import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { NoticeItem, NoticePage } from "./notice-view";

function guard() {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

function moved(atEpoch: number, tokenAtStart: string | null): void {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
}

export async function fetchNotices(state: "all" | "read" | "unread", cursor?: string): Promise<NoticePage> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams({ state, limit: "20" });
  if (cursor) params.set("cursor", cursor);
  const payload = await apiClient<{ success: true; data: NoticePage }>(`/api/v1/notifications?${params.toString()}`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<{ success: true; data: { count: number } }>("/api/v1/notifications/unread-count", {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data.count;
}

export async function setNoticeRead(id: string, isRead: boolean): Promise<void> {
  const { atEpoch, tokenAtStart } = guard();
  await apiClient(`/api/v1/notifications/${id}/${isRead ? "read" : "unread"}`, {
    method: "PATCH",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
}
