import { DOCUMENT_FILE_TYPE_TABLE, DOCUMENT_LIMITS, fileExtension } from "@infraos/shared-types";

import type { AuthLocale } from "@/lib/auth/types";

const LOCALE_TAG: Record<AuthLocale, string> = { en: "en-LK", si: "si-LK", ta: "ta-LK" };

export const fill = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** Sizes use the Intl number formatter of the workspace language; units stay Latin (KB/MB are international). */
export function formatSize(bytes: number | null | undefined, locale: AuthLocale = "en"): string {
  if (bytes === null || bytes === undefined) return "—";
  const nf = (n: number, max: number) => new Intl.NumberFormat(LOCALE_TAG[locale], { maximumFractionDigits: max }).format(n);
  if (bytes < 1024) return `${nf(bytes, 0)} B`;
  if (bytes < 1024 * 1024) return `${nf(bytes / 1024, 1)} KB`;
  return `${nf(bytes / (1024 * 1024), 1)} MB`;
}
export function fmtDate(iso: string | null | undefined, locale: AuthLocale = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat(LOCALE_TAG[locale], { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(d);
}
export function fmtDateTime(iso: string | null | undefined, locale: AuthLocale = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat(LOCALE_TAG[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(d);
}
export const fmtMonth = (ym: string, locale: AuthLocale = "en"): string => new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: "short", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));
export const fmtNumber = (n: number, locale: AuthLocale = "en"): string => new Intl.NumberFormat(LOCALE_TAG[locale]).format(n);

export type FileFamily = "pdf" | "docx" | "xlsx" | "csv" | "txt" | "image" | "other";
export function familyOfName(name: string): FileFamily {
  return (DOCUMENT_FILE_TYPE_TABLE.find((t) => t.ext === fileExtension(name))?.family ?? "other") as FileFamily;
}
export function familyOfMime(mime: string | null | undefined): FileFamily {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  return (DOCUMENT_FILE_TYPE_TABLE.find((t) => (t.mimes as readonly string[]).includes(mime))?.family ?? "other") as FileFamily;
}
export const isPreviewMime = (mime: string | null | undefined): boolean => ["application/pdf", "text/plain", "text/csv", "image/png", "image/jpeg", "image/webp"].includes(mime ?? "");

export type ClientFileError = "FILE_TOO_LARGE" | "FILE_TYPE_NOT_ALLOWED" | "FILE_EMPTY" | "FILE_SIGNATURE_MISMATCH";
/** Instant feedback only. The server re-validates extension, MIME, magic bytes and size and is the authority. */
export function checkClientFile(file: { name: string; size: number; type: string }, allowsImages: boolean): ClientFileError | null {
  const row = DOCUMENT_FILE_TYPE_TABLE.find((t) => t.ext === fileExtension(file.name));
  if (!row) return "FILE_TYPE_NOT_ALLOWED";
  if (row.family === "image" && !allowsImages) return "FILE_TYPE_NOT_ALLOWED";
  if (file.size === 0) return "FILE_EMPTY";
  if (file.size > DOCUMENT_LIMITS.maxFileBytes) return "FILE_TOO_LARGE";
  if (file.type && !(row.mimes as readonly string[]).includes(file.type.toLowerCase())) return "FILE_SIGNATURE_MISMATCH";
  return null;
}
/** Browsers sometimes report an empty type; derive the canonical one from the extension so the server's MIME check can pass. */
export const mimeForName = (name: string, reported: string): string => reported || (DOCUMENT_FILE_TYPE_TABLE.find((t) => t.ext === fileExtension(name))?.mimes[0] ?? "application/octet-stream");

export const SORTS = ["newest", "oldest", "relevance", "title", "size", "updated"] as const;
export type Sort = (typeof SORTS)[number];
export type DocFilters = {
  q: string; category: string[]; group: string; projectId: string; agencyId: string; fileType: string[]; status: string[]; tag: string; mine: boolean; sensitive: boolean; archived: boolean; evidence: boolean;
  from: string; to: string; sort: Sort; page: number; limit: number; contractorId: string; expiring: boolean; awaiting: boolean; drafts: boolean; thisMonth: boolean; aiStatus: string;
};
export const DEFAULT_FILTERS: DocFilters = { q: "", category: [], group: "", projectId: "", agencyId: "", fileType: [], status: [], tag: "", mine: false, sensitive: false, archived: false, evidence: false, from: "", to: "", sort: "newest", page: 1, limit: 25, contractorId: "", expiring: false, awaiting: false, drafts: false, thisMonth: false, aiStatus: "" };

export const AI_STATUSES = ["NOT_STARTED", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "UNSUPPORTED"];
const csv = (v: string | null): string[] => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);
export function parseFilters(get: (k: string) => string | null): DocFilters {
  const sort = get("sort") as Sort;
  const limit = Number(get("limit"));
  return {
    q: (get("q") ?? "").slice(0, 200), category: csv(get("category")), group: get("group") ?? "", projectId: get("projectId") ?? "", agencyId: get("agencyId") ?? "", fileType: csv(get("fileType")), status: csv(get("status")), tag: get("tag") ?? "",
    mine: get("mine") === "1", sensitive: get("sensitive") === "1", archived: get("archived") === "1", evidence: get("evidence") === "1", from: get("from") ?? "", to: get("to") ?? "",
    sort: (SORTS as readonly string[]).includes(sort) ? sort : "newest", page: Math.max(1, Math.min(1000, Number(get("page")) || 1)), limit: [10, 25, 50].includes(limit) ? limit : 25,
    contractorId: get("contractorId") ?? "", expiring: get("expiring") === "1", awaiting: get("awaiting") === "1", drafts: get("drafts") === "1", thisMonth: get("thisMonth") === "1",
    aiStatus: AI_STATUSES.includes(get("aiStatus") ?? "") ? (get("aiStatus") as string) : "",
  };
}
/** API query for a filter set. Quick filters that map to server flags are translated here; nothing is filtered client-side. */
export function toApiQuery(f: DocFilters): Record<string, string | number | boolean | undefined> {
  const status = f.status.length ? f.status : f.archived ? ["ARCHIVED"] : f.drafts ? ["DRAFT"] : undefined;
  return {
    q: f.q || undefined, category: f.category.join(",") || undefined, group: f.group || undefined, projectId: f.projectId || undefined, agencyId: f.agencyId || undefined, fileType: f.fileType.join(",") || undefined,
    status: status?.join(","), tag: f.tag || undefined, uploadedBy: f.mine ? "me" : undefined, confidentiality: f.sensitive ? "SENSITIVE" : undefined, origin: f.evidence ? "INSPECTION_EVIDENCE" : undefined,
    from: f.from || undefined, to: f.to || undefined, contractorId: f.contractorId || undefined, expiring: f.expiring ? "30" : undefined, hasFile: f.awaiting ? false : undefined, thisMonth: f.thisMonth ? true : undefined, aiStatus: f.aiStatus || undefined,
    sort: f.q && f.sort === "newest" ? "relevance" : f.sort, page: f.page, limit: f.limit,
  };
}
export function filterParams(f: DocFilters): Record<string, string | null> {
  const s = (v: string) => (v ? v : null);
  return {
    q: s(f.q), category: f.category.join(",") || null, group: s(f.group), projectId: s(f.projectId), agencyId: s(f.agencyId), fileType: f.fileType.join(",") || null, status: f.status.join(",") || null, tag: s(f.tag),
    mine: f.mine ? "1" : null, sensitive: f.sensitive ? "1" : null, archived: f.archived ? "1" : null, evidence: f.evidence ? "1" : null, from: s(f.from), to: s(f.to), sort: f.sort === "newest" ? null : f.sort,
    limit: f.limit === 25 ? null : String(f.limit), contractorId: s(f.contractorId), expiring: f.expiring ? "1" : null, awaiting: f.awaiting ? "1" : null, drafts: f.drafts ? "1" : null, thisMonth: f.thisMonth ? "1" : null, aiStatus: s(f.aiStatus),
  };
}
export function activeFilterCount(f: DocFilters): number {
  return [f.q, f.category.length, f.group, f.projectId, f.agencyId, f.fileType.length, f.status.length, f.tag, f.mine, f.sensitive, f.archived, f.evidence, f.from, f.to, f.contractorId, f.expiring, f.awaiting, f.drafts, f.thisMonth, f.aiStatus].filter(Boolean).length;
}

/** Saved views: per-user named presets kept in localStorage only (no user-preferences service exists). Max 10, every access guarded. */
const VIEWS_KEY = "infraos.doctrace.views";
export const MAX_VIEWS = 10;
export type SavedView = { name: string; query: string };
export function loadViews(userId: string): SavedView[] {
  try {
    const all = JSON.parse(window.localStorage.getItem(VIEWS_KEY) ?? "{}") as Record<string, SavedView[]>;
    return (all[userId] ?? []).filter((v) => typeof v?.name === "string" && typeof v?.query === "string").slice(0, MAX_VIEWS);
  } catch { return []; }
}
export function saveViews(userId: string, views: SavedView[]): boolean {
  try {
    const all = JSON.parse(window.localStorage.getItem(VIEWS_KEY) ?? "{}") as Record<string, SavedView[]>;
    all[userId] = views.slice(0, MAX_VIEWS);
    window.localStorage.setItem(VIEWS_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}
