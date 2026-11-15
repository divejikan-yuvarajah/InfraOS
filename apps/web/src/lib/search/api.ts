import { apiClient } from "@/lib/api/client";

export type GlobalSearchResultItem = {
  id: string;
  kind: "PROJECT" | "ISSUE" | "CONTRACTOR" | "DOCUMENT" | "ASSET";
  code: string | null;
  title: string;
  subtitle: string;
  status: string | null;
  href: string;
};

export type GlobalSearchResponse = {
  query: string;
  projects: GlobalSearchResultItem[];
  issues: GlobalSearchResultItem[];
  contractors: GlobalSearchResultItem[];
  documents: GlobalSearchResultItem[];
  assets: GlobalSearchResultItem[];
};

export async function fetchGlobalSearch(q: string, limit = 5): Promise<GlobalSearchResponse> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const payload = await apiClient<{ success: true; data: GlobalSearchResponse }>(
    `/api/v1/search?${qs.toString()}`,
    { method: "GET", authenticated: true },
  );
  return payload.data;
}
