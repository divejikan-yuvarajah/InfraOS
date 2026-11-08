import { apiClient } from "@/lib/api/client";
import type {
  AdminRegistrationApproveInput,
  AdminRegistrationListPayload,
  AdminRegistrationRecord,
  AdminRegistrationRejectInput,
} from "./types";

export type AdminRegistrationQuery = {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
};

export async function fetchAdminRegistrations(
  query: AdminRegistrationQuery = {},
): Promise<AdminRegistrationListPayload> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));

  const qs = params.toString();
  const path = `/api/v1/admin/registrations${qs ? `?${qs}` : ""}`;

  const envelope = await apiClient<{ success: boolean; data: AdminRegistrationListPayload }>(
    path,
    {
      method: "GET",
      authenticated: true,
    },
  );

  return envelope.data;
}

export async function fetchAdminRegistration(
  id: string,
): Promise<AdminRegistrationRecord> {
  const envelope = await apiClient<{ success: boolean; data: { request: AdminRegistrationRecord } }>(
    `/api/v1/admin/registrations/${id}`,
    {
      method: "GET",
      authenticated: true,
    },
  );

  return envelope.data.request;
}

export async function approveAdminRegistration(
  id: string,
  body: AdminRegistrationApproveInput,
): Promise<{ ok: boolean; user?: { id: string; email: string; status: string } }> {
  const envelope = await apiClient<{ success: boolean; data: { ok: boolean; user: { id: string; email: string; status: string } } }>(
    `/api/v1/admin/registrations/${id}/approve`,
    {
      method: "POST",
      authenticated: true,
      body,
    },
  );

  return envelope.data;
}

export async function rejectAdminRegistration(
  id: string,
  body: AdminRegistrationRejectInput,
): Promise<{ ok: boolean }> {
  const envelope = await apiClient<{ success: boolean; data: { ok: boolean } }>(
    `/api/v1/admin/registrations/${id}/reject`,
    {
      method: "POST",
      authenticated: true,
      body,
    },
  );

  return envelope.data;
}

