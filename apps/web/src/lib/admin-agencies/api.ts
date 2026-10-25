import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

import type { AgencyListPayload, AgencyPayload, AgencyRecord } from "./types";

function guard(): { atEpoch: number; tokenAtStart: string } {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  return { atEpoch, tokenAtStart };
}

function moved(atEpoch: number, tokenAtStart: string): void {
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
}

export async function fetchAgencies(query: { page?: number; q?: string; status?: string; type?: string }) {
  const { atEpoch, tokenAtStart } = guard();
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.type) params.set("type", query.type);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const payload = await apiClient<AgencyListPayload>(`/api/v1/admin/agencies${suffix}`, {
    method: "GET",
    authenticated: true,
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

async function mutate(path: string, method: "POST" | "PATCH", body: unknown): Promise<AgencyRecord> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<AgencyPayload>(path, { method, authenticated: true, body });
  moved(atEpoch, tokenAtStart);
  return payload.data.agency;
}

export function createAgency(body: {
  code: string;
  name: string;
  type: string;
  parentAgencyId: string | null;
}): Promise<AgencyRecord> {
  return mutate("/api/v1/admin/agencies", "POST", body);
}

export function updateAgencyName(id: string, body: { name: string; revision: number }): Promise<AgencyRecord> {
  return mutate(`/api/v1/admin/agencies/${id}`, "PATCH", body);
}

export function reparentAgency(id: string, body: { parentAgencyId: string | null; revision: number }): Promise<AgencyRecord> {
  return mutate(`/api/v1/admin/agencies/${id}/reparent`, "POST", body);
}

export function deactivateAgency(id: string, revision: number): Promise<AgencyRecord> {
  return mutate(`/api/v1/admin/agencies/${id}/deactivate`, "POST", { revision });
}
