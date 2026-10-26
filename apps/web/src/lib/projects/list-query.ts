export const PROJECT_TYPES = [
  "ROAD",
  "WATER",
  "ELECTRICITY",
  "TELECOM",
  "DRAINAGE",
  "BRIDGE",
  "BUILDING",
  "PUBLIC_FACILITY",
  "MULTI_INFRASTRUCTURE",
  "OTHER",
] as const;

export const PROJECT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "ACTIVE",
  "ON_HOLD",
  "DELAYED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_LIST_SORTS = [
  "createdAt",
  "updatedAt",
  "projectCode",
  "title",
  "projectType",
  "status",
  "startDate",
  "plannedEndDate",
] as const;

export const PROJECT_LIST_PAGE_SIZES = [10, 20] as const;

const CREATE_ROLE_HINTS = new Set(["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);

export type ProjectListSort = (typeof PROJECT_LIST_SORTS)[number];

export type ProjectListState = {
  page: number;
  limit: number;
  q: string;
  status: string;
  type: string;
  agencyId: string;
  sortBy: ProjectListSort;
  sortDir: "asc" | "desc";
};

export const EMPTY_PROJECT_LIST_STATE: ProjectListState = {
  page: 1,
  limit: 10,
  q: "",
  status: "",
  type: "",
  agencyId: "",
  sortBy: "createdAt",
  sortDir: "desc",
};

function sortField(value: string | null): ProjectListSort {
  return PROJECT_LIST_SORTS.find((field) => field === value) ?? "createdAt";
}

export function parseProjectListParams(params: URLSearchParams): ProjectListState {
  const page = Number(params.get("page") ?? "1");
  const limit = Number(params.get("limit") ?? "10");
  const status = params.get("status") ?? "";
  const type = params.get("type") ?? "";
  const agencyId = params.get("agencyId") ?? "";
  return {
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
    limit: PROJECT_LIST_PAGE_SIZES.find((size) => size === limit) ?? 10,
    q: (params.get("q") ?? "").trim().slice(0, 80),
    status: PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number]) ? status : "",
    type: PROJECT_TYPES.includes(type as (typeof PROJECT_TYPES)[number]) ? type : "",
    agencyId: /^[a-fA-F0-9]{24}$/.test(agencyId) ? agencyId : "",
    sortBy: sortField(params.get("sortBy")),
    sortDir: params.get("sortDir") === "asc" ? "asc" : "desc",
  };
}

export function serializeProjectListParams(state: ProjectListState): string {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("limit", String(state.limit));
  if (state.q.trim()) params.set("q", state.q.trim().slice(0, 80));
  if (state.status) params.set("status", state.status);
  if (state.type) params.set("type", state.type);
  if (/^[a-fA-F0-9]{24}$/.test(state.agencyId)) params.set("agencyId", state.agencyId);
  params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  return params.toString();
}

export function toProjectListRequest(state: ProjectListState) {
  return {
    page: state.page,
    limit: state.limit,
    q: state.q.trim() || undefined,
    status: state.status || undefined,
    type: state.type || undefined,
    agencyId: /^[a-fA-F0-9]{24}$/.test(state.agencyId) ? state.agencyId : undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}

export function resetProjectListPage(state: ProjectListState, patch: Partial<ProjectListState>): ProjectListState {
  return { ...state, ...patch, page: 1 };
}

export function canHintProjectCreate(roleKey: string | null | undefined): boolean {
  return CREATE_ROLE_HINTS.has(roleKey ?? "");
}
