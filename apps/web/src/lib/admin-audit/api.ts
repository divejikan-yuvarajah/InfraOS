import { ApiError, apiClient } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken } from "@/lib/auth/state";

export interface AdminAuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorAgencyId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  outcome: "SUCCESS" | "DENIED" | "FAILURE";
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuditLogListPayload {
  success: true;
  data: {
    items: AdminAuditLogEntry[];
    total: number;
  };
}

export async function fetchAdminAuditLogs(limit = 50): Promise<AdminAuditLogListPayload["data"]> {
  const atEpoch = getAuthEpoch();
  const tokenAtStart = getMemoryAccessToken();
  if (!tokenAtStart) {
    throw new ApiError("sign-in is required", 401, { code: "AUTH_REQUIRED" });
  }
  const payload = await apiClient<AdminAuditLogListPayload>(
    `/api/v1/admin/audit-logs?limit=${limit}`,
    {
      method: "GET",
      authenticated: true,
    },
  );
  if (getAuthEpoch() !== atEpoch || getMemoryAccessToken() !== tokenAtStart) {
    throw new ApiError("session moved", 401, { code: "AUTH_REQUIRED" });
  }
  return payload.data;
}

