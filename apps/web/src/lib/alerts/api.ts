import { apiClient } from "@/lib/api/client";

export type SystemAlertItem = {
  id: string;
  kind: string;
  severity: "WARNING" | "CRITICAL";
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  actionUrl: string | null;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledgedAt: string | null;
  lastEvaluatedAt: string;
};

export type SystemAlertsPage = {
  items: SystemAlertItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchSystemAlerts(params: {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
}): Promise<SystemAlertsPage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status) qs.set("status", params.status);
  if (params.severity) qs.set("severity", params.severity);
  const res = await apiClient<{ success: true; data: SystemAlertsPage }>(
    `/api/v1/alerts?${qs.toString()}`,
    { method: "GET", authenticated: true },
  );
  return res.data;
}

export async function acknowledgeSystemAlert(id: string): Promise<void> {
  await apiClient(`/api/v1/alerts/${id}/acknowledge`, {
    method: "POST",
    authenticated: true,
  });
}

export async function triggerAlertEvaluation(): Promise<{ created: number; evaluated: number }> {
  const res = await apiClient<{ success: true; data: { created: number; evaluated: number } }>(
    "/api/v1/alerts/evaluate",
    { method: "POST", authenticated: true },
  );
  return res.data;
}
