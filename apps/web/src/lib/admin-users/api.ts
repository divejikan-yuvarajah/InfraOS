import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { AdminUserListPayload, AdminUserPayload, AdminUserRecord } from "./types";

function sessionMoved(atEpoch: number, tokenAtStart: string | null): boolean {
  return getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart;
}

function guard(): { atEpoch: number; tokenAtStart: string } {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

export async function fetchAdminUsers(query: {
  page?: number;
  q?: string;
  status?: string;
}): Promise<AdminUserListPayload["data"]> {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const payload = await apiClient<AdminUserListPayload>(`/api/v1/admin/users${suffix}`, {
    method: "GET",
    authenticated: true,
  });
  if (sessionMoved(atEpoch, tokenAtStart)) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data;
}

async function mutate(path: string, method: "POST" | "PATCH", body: unknown): Promise<AdminUserRecord> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<AdminUserPayload>(path, {
    method,
    authenticated: true,
    body,
  });
  if (sessionMoved(atEpoch, tokenAtStart)) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data.user;
}

export function createAdminUser(body: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleKey: string;
  agencyCode: string;
}): Promise<AdminUserRecord> {
  return mutate("/api/v1/admin/users", "POST", body);
}

export function updateAdminUserName(
  id: string,
  body: { firstName: string; lastName: string; revision: number },
): Promise<AdminUserRecord> {
  return mutate(`/api/v1/admin/users/${id}`, "PATCH", body);
}

export function disableAdminUser(id: string, revision: number): Promise<AdminUserRecord> {
  return mutate(`/api/v1/admin/users/${id}/disable`, "POST", { revision });
}

export function enableAdminUser(id: string, revision: number): Promise<AdminUserRecord> {
  return mutate(`/api/v1/admin/users/${id}/enable`, "POST", { revision });
}
