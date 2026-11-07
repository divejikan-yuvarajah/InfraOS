import { CERT_EXPIRY, CONTRACTOR_CATEGORIES, CONTRACTOR_STATUSES, RISK_BANDS, SORTS, type ContractorCategory, type ContractorStatus, type RiskBand, type SortKey } from "./types";

/** Directory filter state. It lives in the URL (shareable, back-button safe) and every field is applied by the server. */
export type ContractorListState = {
  q: string; status: ContractorStatus[]; category: ContractorCategory | ""; district: string; agencyId: string; riskBand: RiskBand | "";
  cert: (typeof CERT_EXPIRY)[number] | ""; hasActive: "" | "yes" | "no"; sort: SortKey; page: number; limit: 10 | 20 | 50;
};

export const EMPTY_LIST_STATE: ContractorListState = { q: "", status: [], category: "", district: "", agencyId: "", riskBand: "", cert: "", hasActive: "", sort: "name", page: 1, limit: 20 };

const pick = <T extends string>(allowed: readonly T[], value: string | null): T | "" => (value && (allowed as readonly string[]).includes(value) ? (value as T) : "");

export function parseListParams(params: URLSearchParams): ContractorListState {
  const status = (params.get("status") ?? "").split(",").filter((s): s is ContractorStatus => (CONTRACTOR_STATUSES as readonly string[]).includes(s));
  const page = Number(params.get("page"));
  const limit = Number(params.get("limit"));
  const hasActive = params.get("active");
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    status: [...new Set(status)],
    category: pick(CONTRACTOR_CATEGORIES, params.get("category")),
    district: (params.get("district") ?? "").slice(0, 40),
    agencyId: /^[a-f0-9]{24}$/i.test(params.get("agency") ?? "") ? (params.get("agency") as string) : "",
    riskBand: pick(RISK_BANDS, params.get("risk")),
    cert: pick(CERT_EXPIRY, params.get("cert")),
    hasActive: hasActive === "yes" || hasActive === "no" ? hasActive : "",
    sort: (SORTS as readonly string[]).includes(params.get("sort") ?? "") ? (params.get("sort") as SortKey) : "name",
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
    limit: limit === 10 || limit === 50 ? limit : 20,
  };
}

/** Only non-default values are written, so the default directory has a clean URL. */
export function serializeListParams(state: ContractorListState): string {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.status.length) p.set("status", state.status.join(","));
  if (state.category) p.set("category", state.category);
  if (state.district) p.set("district", state.district);
  if (state.agencyId) p.set("agency", state.agencyId);
  if (state.riskBand) p.set("risk", state.riskBand);
  if (state.cert) p.set("cert", state.cert);
  if (state.hasActive) p.set("active", state.hasActive);
  if (state.sort !== "name") p.set("sort", state.sort);
  if (state.page !== 1) p.set("page", String(state.page));
  if (state.limit !== 20) p.set("limit", String(state.limit));
  return p.toString();
}

/** The API's own query names. Page resets to 1 whenever a filter changes (see withFilter). */
export function toListRequest(state: ContractorListState): Record<string, string | number | undefined> {
  return {
    q: state.q || undefined, status: state.status.length ? state.status.join(",") : undefined, category: state.category || undefined, district: state.district || undefined,
    agencyId: state.agencyId || undefined, riskBand: state.riskBand || undefined, certExpiringDays: state.cert || undefined,
    hasActiveProjects: state.hasActive ? String(state.hasActive === "yes") : undefined, sort: state.sort, page: state.page, limit: state.limit,
  };
}

export const withFilter = (state: ContractorListState, patch: Partial<ContractorListState>): ContractorListState => ({ ...state, ...patch, page: 1 });

export type AppliedChip = { key: string; kind: keyof ContractorListState; value?: string };
export function appliedChips(state: ContractorListState): AppliedChip[] {
  const chips: AppliedChip[] = [];
  if (state.q) chips.push({ key: "q", kind: "q" });
  for (const s of state.status) chips.push({ key: `status:${s}`, kind: "status", value: s });
  if (state.category) chips.push({ key: "category", kind: "category", value: state.category });
  if (state.district) chips.push({ key: "district", kind: "district", value: state.district });
  if (state.agencyId) chips.push({ key: "agency", kind: "agencyId", value: state.agencyId });
  if (state.riskBand) chips.push({ key: "risk", kind: "riskBand", value: state.riskBand });
  if (state.cert) chips.push({ key: "cert", kind: "cert", value: state.cert });
  if (state.hasActive) chips.push({ key: "active", kind: "hasActive", value: state.hasActive });
  return chips;
}

export function removeChip(state: ContractorListState, chip: AppliedChip): ContractorListState {
  switch (chip.kind) {
    case "status": return withFilter(state, { status: state.status.filter((s) => s !== chip.value) });
    case "q": return withFilter(state, { q: "" });
    case "category": return withFilter(state, { category: "" });
    case "district": return withFilter(state, { district: "" });
    case "agencyId": return withFilter(state, { agencyId: "" });
    case "riskBand": return withFilter(state, { riskBand: "" });
    case "cert": return withFilter(state, { cert: "" });
    case "hasActive": return withFilter(state, { hasActive: "" });
    default: return state;
  }
}

/** Role hints only choose what to render; the server is the authority and answers 403/404 on its own. */
export const canHintManage = (roleKey: string): boolean => roleKey === "SUPER_ADMIN" || roleKey === "GOV_ADMIN";
export const canHintPerformance = canHintManage;
export const canHintRead = (roleKey: string): boolean => ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(roleKey);
