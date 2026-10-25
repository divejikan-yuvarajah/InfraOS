import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { CatalogPayload, RoleListPayload, RolePayload, RoleRecord } from "./types";

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

export async function fetchRoles(): Promise<RoleRecord[]> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<RoleListPayload>("/api/v1/admin/roles", { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data.roles;
}

export async function fetchPermissionCatalog(): Promise<CatalogPayload["data"]["catalog"]> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<CatalogPayload>("/api/v1/admin/permissions", { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data.catalog;
}

export async function updateRoleText(id: string, body: { name: string; description: string; revision: number }) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<RolePayload>(`/api/v1/admin/roles/${id}`, { method: "PATCH", authenticated: true, body });
  moved(atEpoch, tokenAtStart);
  return payload.data.role;
}

export async function updateRoleGrants(
  id: string,
  body: { permissions: string[]; revision: number; reason: string },
) {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<RolePayload>(`/api/v1/admin/roles/${id}/permissions`, {
    method: "PUT",
    authenticated: true,
    body,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data.role;
}
