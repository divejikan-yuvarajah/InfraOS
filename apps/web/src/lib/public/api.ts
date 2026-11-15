import { getPublicApiBaseUrl } from "@/lib/env/public";
import type {
  PublicIssueSubmitResponse,
  PublicIssueTrackResponse,
  PublicMapFeaturesResponse,
  PublicProject,
  PublicProjectPage,
  PublicSummary,
} from "./types";

function apiUrl(path: string): string {
  const baseUrl = getPublicApiBaseUrl();
  const base = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/v1` : "/api/v1";
  return `${base}${path}`;
}

async function fetchPublicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: { message?: string } } | null;
  if (!res.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error?.message ?? "Request failed");
  }
  return body.data;
}

export function fetchPublicSummary(): Promise<PublicSummary> {
  return fetchPublicJson<PublicSummary>("/public/summary");
}

export function fetchPublicProjects(params: {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  status?: string;
  district?: string;
}): Promise<PublicProjectPage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.status) qs.set("status", params.status);
  if (params.district) qs.set("district", params.district);
  const query = qs.toString();
  return fetchPublicJson<PublicProjectPage>(`/public/projects${query ? `?${query}` : ""}`);
}

export function fetchPublicProjectBySlug(slug: string): Promise<PublicProject> {
  return fetchPublicJson<PublicProject>(`/public/projects/${encodeURIComponent(slug)}`);
}

export function fetchPublicMapFeatures(bbox?: string): Promise<PublicMapFeaturesResponse> {
  const query = bbox ? `?bbox=${encodeURIComponent(bbox)}` : "";
  return fetchPublicJson<PublicMapFeaturesResponse>(`/public/map/features${query}`);
}

export function submitPublicIssue(payload: {
  category: string;
  title?: string;
  description: string;
  priority?: string;
  website?: string;
  location: { addressLine?: string; district: string; province: string; lat?: number; lng?: number };
  contact?: { name?: string; phone?: string; email?: string };
  photos?: Array<{ base64: string; fileName?: string }>;
}): Promise<PublicIssueSubmitResponse> {
  return fetchPublicJson<PublicIssueSubmitResponse>("/public/issues", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function trackPublicIssue(referenceNo: string, trackingSecret: string): Promise<PublicIssueTrackResponse> {
  return fetchPublicJson<PublicIssueTrackResponse>("/public/issues/track", {
    method: "POST",
    body: JSON.stringify({ referenceNo, trackingSecret }),
  });
}

export function publicIssuePhotoUrl(referenceNo: string, trackingSecret: string, index: number): string {
  const qs = new URLSearchParams({ referenceNo, trackingSecret });
  return apiUrl(`/public/issues/track/photos/${index}?${qs.toString()}`);
}
