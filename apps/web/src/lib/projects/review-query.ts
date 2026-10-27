export const REVIEW_QUEUE_STATUSES = ["SUBMITTED", "UNDER_REVIEW"] as const;
export const REVIEW_QUEUE_SORTS = ["updatedAt", "createdAt", "title", "projectCode", "status"] as const;
export const REVIEW_QUEUE_PAGE_SIZES = [10, 25] as const;

export type ReviewQueueState = {
  page: number;
  limit: (typeof REVIEW_QUEUE_PAGE_SIZES)[number];
  q: string;
  status: "" | (typeof REVIEW_QUEUE_STATUSES)[number];
  agencyId: string;
  sortBy: (typeof REVIEW_QUEUE_SORTS)[number];
  sortDir: "asc" | "desc";
};

export const EMPTY_REVIEW_QUEUE: ReviewQueueState = {
  page: 1,
  limit: 10,
  q: "",
  status: "",
  agencyId: "",
  sortBy: "updatedAt",
  sortDir: "desc",
};

export function parseReviewQueue(params: URLSearchParams): ReviewQueueState {
  const page = Number(params.get("page") ?? "1");
  const limit = Number(params.get("limit") ?? "10");
  const status = params.get("status") ?? "";
  const sortBy = params.get("sortBy") ?? "updatedAt";
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";
  return {
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
    limit: REVIEW_QUEUE_PAGE_SIZES.find((size) => size === limit) ?? 10,
    q: (params.get("q") ?? "").slice(0, 80),
    status: REVIEW_QUEUE_STATUSES.find((item) => item === status) ?? "",
    agencyId: /^[a-fA-F0-9]{24}$/.test(params.get("agencyId") ?? "") ? (params.get("agencyId") ?? "") : "",
    sortBy: REVIEW_QUEUE_SORTS.find((field) => field === sortBy) ?? "updatedAt",
    sortDir,
  };
}

export function serializeReviewQueue(state: ReviewQueueState): string {
  const params = new URLSearchParams();
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.limit !== 10) params.set("limit", String(state.limit));
  if (state.q) params.set("q", state.q);
  if (state.status) params.set("status", state.status);
  if (state.agencyId) params.set("agencyId", state.agencyId);
  if (state.sortBy !== "updatedAt") params.set("sortBy", state.sortBy);
  if (state.sortDir !== "desc") params.set("sortDir", state.sortDir);
  return params.toString();
}
