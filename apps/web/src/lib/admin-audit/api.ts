import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

export interface AdminAuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorAgencyId: string | null;
  agencyCode: string | null;
  action: string;
  entityType: string;
  entityId: string;
  outcome: "SUCCESS" | "DENIED" | "FAILURE";
  requestId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type RawAuditLogRow = {
  id: string;
  userId?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  agencyId?: string | null;
  actorAgencyId?: string | null;
  agencyCode?: string | null;
  action: string;
  resourceType?: string;
  entityType?: string;
  resourceId?: string | null;
  entityId?: string | null;
  outcome?: "SUCCESS" | "DENIED" | "FAILURE";
  requestId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  createdAt?: string;
};

export interface AdminAuditLogQuery {
  limit?: number;
  cursor?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export async function fetchAdminAuditLogs(
  input: number | AdminAuditLogQuery = 50,
): Promise<{ items: AdminAuditLogEntry[]; total: number; nextCursor: string | null }> {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) {
    throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  }
  const opts: AdminAuditLogQuery = typeof input === "number" ? { limit: input } : input;
  const qs = new URLSearchParams();
  qs.set("limit", String(opts.limit ?? 50));
  if (opts.cursor) qs.set("cursor", opts.cursor);
  if (opts.action) qs.set("action", opts.action);
  if (opts.resourceType) qs.set("resourceType", opts.resourceType);
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);

  const payload = await apiClient<{
    success: true;
    data: { items: RawAuditLogRow[]; total?: number; nextCursor?: string | null };
  }>(`/api/v1/admin/audit-logs?${qs.toString()}`, {
    method: "GET",
    authenticated: true,
  });
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }

  const items: AdminAuditLogEntry[] = (payload.data.items ?? []).map((row) => ({
    id: row.id,
    actorUserId: row.userId ?? row.actorUserId ?? null,
    actorName: row.actorName ?? null,
    actorEmail: row.actorEmail ?? null,
    actorAgencyId: row.agencyId ?? row.actorAgencyId ?? null,
    agencyCode: row.agencyCode ?? null,
    action: row.action,
    entityType: row.resourceType ?? row.entityType ?? "SYSTEM",
    entityId: row.resourceId ?? row.entityId ?? "",
    outcome: row.outcome ?? "SUCCESS",
    requestId: row.requestId ?? null,
    oldValue: row.oldValue ?? null,
    newValue: row.newValue ?? null,
    metadata: row.metadata ?? row.newValue ?? {},
    createdAt: row.timestamp ?? row.createdAt ?? new Date().toISOString(),
  }));

  return {
    items,
    total: payload.data.total ?? items.length,
    nextCursor: payload.data.nextCursor ?? null,
  };
}

export type AdminGovernanceSummary = {
  failedLoginCount7d: number;
  recentSensitiveActions: Array<{
    id: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    summary: Record<string, unknown> | null;
    timestamp: string;
  }>;
  recentExports: Array<{
    id: string;
    userId: string;
    summary: Record<string, unknown> | null;
    timestamp: string;
  }>;
};

export async function fetchAdminGovernance(): Promise<AdminGovernanceSummary> {
  const payload = await apiClient<{ success: true; data: AdminGovernanceSummary }>(
    "/api/v1/admin/audit-logs/governance",
    { method: "GET", authenticated: true },
  );
  return payload.data;
}
