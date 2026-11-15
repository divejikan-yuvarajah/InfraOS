import { apiClient } from "@/lib/api/client";
import { getPublicApiBaseUrl } from "@/lib/env/public";
import { getMemoryAccessToken } from "@/lib/auth/state";

export type StaffIssueItem = {
  id: string;
  referenceNo: string | null;
  category: string;
  title: string | null;
  description: string;
  district: string | null;
  province: string | null;
  status: string;
  priority: string;
  publicMapVisible: boolean;
  assignedAgency: { id: string; code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffIssueListResponse = {
  items: StaffIssueItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type StaffIssueDetail = StaffIssueItem & {
  location: { addressLine?: string | null; district?: string | null; province?: string | null };
  duplicateOfIssueId: string | null;
  photoCount: number;
  photos: Array<{ index: number; fileName: string; mimeType: string; sizeBytes: number }>;
  contact: { name?: string | null; phone?: string | null; email?: string | null } | null;
  statusHistory: Array<{ fromStatus?: string | null; toStatus: string; note?: string | null; changedAt: string }>;
  internalNotes: Array<{ authorId: string; body: string; createdAt: string }>;
  publicMessages: Array<{ authorLabel: string; body: string; createdAt: string }>;
  allowedTransitions: string[];
};

export type IssueRoutingRuleItem = {
  id: string;
  category: string;
  province: string | null;
  district: string | null;
  agency: { id: string; code: string; name: string } | null;
  priorityOrder: number;
  isActive: boolean;
};

export function fetchStaffIssues(params: {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  category?: string;
  priority?: string;
  unassigned?: boolean;
}): Promise<StaffIssueListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.priority) qs.set("priority", params.priority);
  if (params.unassigned) qs.set("unassigned", "true");
  const query = qs.toString();
  return apiClient<StaffIssueListResponse>(`/issues${query ? `?${query}` : ""}`, { authenticated: true });
}

export function fetchStaffIssueDetail(id: string): Promise<StaffIssueDetail> {
  return apiClient<StaffIssueDetail>(`/issues/${encodeURIComponent(id)}`, { authenticated: true });
}

export function routeStaffIssue(id: string, body: { agencyId: string; publicMapVisible?: boolean }) {
  return apiClient(`/issues/${encodeURIComponent(id)}/route`, { method: "PATCH", body, authenticated: true });
}

export function transitionStaffIssue(
  id: string,
  body: { toStatus: string; publicMessage?: string; internalNote?: string; publicMapVisible?: boolean },
) {
  return apiClient(`/issues/${encodeURIComponent(id)}/status`, { method: "PATCH", body, authenticated: true });
}

export function addStaffIssueNote(id: string, body: { kind: "INTERNAL" | "PUBLIC"; body: string }) {
  return apiClient(`/issues/${encodeURIComponent(id)}/notes`, { method: "POST", body, authenticated: true });
}

export function fetchIssueRoutingRules(): Promise<{ items: IssueRoutingRuleItem[] }> {
  return apiClient<{ items: IssueRoutingRuleItem[] }>("/issues/routing-rules", { authenticated: true });
}

export function createIssueRoutingRule(body: {
  category: string;
  province?: string;
  district?: string;
  agencyId: string;
  priorityOrder?: number;
}) {
  return apiClient("/issues/routing-rules", { method: "POST", body, authenticated: true });
}

export function deleteIssueRoutingRule(id: string) {
  return apiClient(`/issues/routing-rules/${encodeURIComponent(id)}`, { method: "DELETE", authenticated: true });
}

export async function fetchStaffIssuePhotoBlobUrl(issueId: string, index: number): Promise<string | null> {
  const baseUrl = getPublicApiBaseUrl();
  const token = getMemoryAccessToken();
  if (!baseUrl || !token) return null;
  const res = await fetch(`${baseUrl}/api/v1/issues/${encodeURIComponent(issueId)}/photos/${index}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function updateProjectPublicRelease(
  projectId: string,
  body: {
    isPublic: boolean;
    slug?: string;
    showProgress?: boolean;
    showBudgetBand?: boolean;
    showCoordinates?: boolean;
    safeTitle?: string;
    safeSummary?: string;
  },
) {
  return apiClient(`/projects/${encodeURIComponent(projectId)}/public-release`, {
    method: "PATCH",
    body,
    authenticated: true,
  });
}
