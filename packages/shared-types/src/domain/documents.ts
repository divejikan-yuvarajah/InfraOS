/**
 * DocTrace shared contracts (Phase 10 Batch 08): the category registry, file-type allowlist and limits used by BOTH the API and the web app.
 *
 * Adding a category = ONE entry in DOCUMENT_CATEGORIES + its i18n keys (`documents.category.<KEY>`) in the web message dictionaries.
 * Categories without a legacy `Document.documentType` equivalent map to "OTHER" so existing readers of `documentType` keep working.
 */

export const DOCUMENT_CATEGORY_GROUPS = ["PLANNING", "CONTRACT_FINANCE", "INSPECTION_EVIDENCE", "GOVERNMENT", "COMPLETION_ASSETS"] as const;
export type DocumentCategoryGroup = (typeof DOCUMENT_CATEGORY_GROUPS)[number];

export type LegacyDocumentType = "CONTRACT" | "TENDER" | "BOQ" | "INVOICE" | "APPROVAL" | "PROGRESS_REPORT" | "INSPECTION_REPORT" | "SITE_EVIDENCE" | "DRAWING" | "OTHER";

export type DocumentCategoryDef = {
  key: string;
  group: DocumentCategoryGroup;
  legacyDocumentType: LegacyDocumentType;
  requiresProject: boolean;
  defaultVisibility: "INTERNAL" | "PROJECT_TEAM";
  /** Inspectors (assigned projects only) may see PROJECT_TEAM/PUBLIC documents in these categories. Never finance or contract terms. */
  inspectorVisible: boolean;
  sensitiveByDefault: boolean;
  /** lucide icon name used by the web app. */
  icon: string;
  /** Link types this category may carry (enforced server-side). */
  links: readonly DocumentLinkKey[];
  /** Images are only accepted for categories with this flag. */
  allowsImages: boolean;
};

export const DOCUMENT_LINK_KEYS = ["contractorId", "inspectionId", "paymentId", "expenseId", "assetId", "milestoneId"] as const;
export type DocumentLinkKey = (typeof DOCUMENT_LINK_KEYS)[number];

const c = (key: string, group: DocumentCategoryGroup, legacyDocumentType: LegacyDocumentType, icon: string, o: Partial<Omit<DocumentCategoryDef, "key" | "group" | "legacyDocumentType" | "icon">> = {}): DocumentCategoryDef => ({
  key, group, legacyDocumentType, icon, requiresProject: true, defaultVisibility: "INTERNAL", inspectorVisible: false, sensitiveByDefault: false, links: [], allowsImages: false, ...o,
});

export const DOCUMENT_CATEGORIES: readonly DocumentCategoryDef[] = [
  c("PROJECT_PROPOSAL", "PLANNING", "OTHER", "Lightbulb"),
  c("PROJECT_PLAN", "PLANNING", "OTHER", "ClipboardList", { inspectorVisible: true, defaultVisibility: "PROJECT_TEAM" }),
  c("ENGINEERING_DRAWING", "PLANNING", "DRAWING", "Ruler", { inspectorVisible: true, defaultVisibility: "PROJECT_TEAM", allowsImages: true }),
  c("CONTRACT", "CONTRACT_FINANCE", "CONTRACT", "FileSignature", { links: ["contractorId"] }),
  c("TENDER", "CONTRACT_FINANCE", "TENDER", "Gavel", { links: ["contractorId"] }),
  c("BOQ", "CONTRACT_FINANCE", "BOQ", "ListOrdered", { links: ["contractorId"] }),
  c("BUDGET_DOCUMENT", "CONTRACT_FINANCE", "OTHER", "Wallet", { links: ["expenseId"] }),
  c("PAYMENT_EVIDENCE", "CONTRACT_FINANCE", "INVOICE", "Receipt", { links: ["paymentId", "expenseId", "contractorId"] }),
  c("INSPECTION_REPORT", "INSPECTION_EVIDENCE", "INSPECTION_REPORT", "ClipboardCheck", { inspectorVisible: true, defaultVisibility: "PROJECT_TEAM", links: ["inspectionId", "milestoneId"] }),
  c("SITE_EVIDENCE", "INSPECTION_EVIDENCE", "SITE_EVIDENCE", "Camera", { inspectorVisible: true, defaultVisibility: "PROJECT_TEAM", links: ["inspectionId"], allowsImages: true }),
  c("GOVERNMENT_CORRESPONDENCE", "GOVERNMENT", "OTHER", "Mail", { requiresProject: false }),
  c("APPROVAL_DOCUMENT", "GOVERNMENT", "APPROVAL", "Stamp"),
  c("PROGRESS_REPORT", "COMPLETION_ASSETS", "PROGRESS_REPORT", "TrendingUp", { links: ["milestoneId"], defaultVisibility: "PROJECT_TEAM" }),
  c("COMPLETION_REPORT", "COMPLETION_ASSETS", "OTHER", "BadgeCheck", { inspectorVisible: true, defaultVisibility: "PROJECT_TEAM", links: ["milestoneId"] }),
  c("ASSET_HANDOVER_RECORD", "COMPLETION_ASSETS", "OTHER", "Handshake", { links: ["assetId"] }),
  c("MAINTENANCE_DOCUMENT", "COMPLETION_ASSETS", "OTHER", "Wrench", { links: ["assetId"] }),
  c("OTHER", "GOVERNMENT", "OTHER", "File", { requiresProject: false, allowsImages: true }),
];

export const DOCUMENT_CATEGORY_KEYS = DOCUMENT_CATEGORIES.map((x) => x.key) as readonly string[];
export const categoryDef = (key: string): DocumentCategoryDef | undefined => DOCUMENT_CATEGORIES.find((x) => x.key === key);

/** Legacy `documentType` -> category, used by the backfill and when old rows are read. */
export const LEGACY_TYPE_TO_CATEGORY: Record<LegacyDocumentType, string> = {
  CONTRACT: "CONTRACT", TENDER: "TENDER", BOQ: "BOQ", INVOICE: "PAYMENT_EVIDENCE", APPROVAL: "APPROVAL_DOCUMENT", PROGRESS_REPORT: "PROGRESS_REPORT",
  INSPECTION_REPORT: "INSPECTION_REPORT", SITE_EVIDENCE: "SITE_EVIDENCE", DRAWING: "ENGINEERING_DRAWING", OTHER: "OTHER",
};

export const DOCUMENT_STATUSES = ["DRAFT", "ACTIVE", "SUPERSEDED", "ARCHIVED"] as const;
export const DOCUMENT_CONFIDENTIALITIES = ["STANDARD", "SENSITIVE"] as const;
export const DOCUMENT_ORIGINS = ["DOCTRACE", "INSPECTION_EVIDENCE", "SYSTEM"] as const;
export const DOCUMENT_LANGUAGES = ["en", "si", "ta", "mixed", "unknown"] as const;
export const DOCUMENT_FILE_TYPES = ["pdf", "docx", "xlsx", "csv", "txt", "image"] as const;

/** One place for the file allowlist. Server validates extension + declared MIME + magic bytes; the web mirrors this for instant feedback only. */
export const DOCUMENT_FILE_TYPE_TABLE = [
  { ext: "pdf", family: "pdf", mimes: ["application/pdf"], preview: true },
  { ext: "docx", family: "docx", mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], preview: false },
  { ext: "xlsx", family: "xlsx", mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], preview: false },
  { ext: "csv", family: "csv", mimes: ["text/csv", "application/vnd.ms-excel", "text/plain"], preview: true },
  { ext: "txt", family: "txt", mimes: ["text/plain"], preview: true },
  { ext: "png", family: "image", mimes: ["image/png"], preview: true },
  { ext: "jpg", family: "image", mimes: ["image/jpeg"], preview: true },
  { ext: "jpeg", family: "image", mimes: ["image/jpeg"], preview: true },
  { ext: "webp", family: "image", mimes: ["image/webp"], preview: true },
] as const;

export const DOCUMENT_LIMITS = {
  /** Default per-file cap. GridFS lives in the same Atlas cluster, so this stays modest for small tiers. The API may lower it via DOCUMENT_MAX_FILE_MB. */
  maxFileBytes: 25 * 1024 * 1024,
  maxBatchFiles: 10,
  maxBatchBytes: 100 * 1024 * 1024,
  maxVersions: 20,
  maxTags: 15,
} as const;

export const DOCUMENT_ERROR_CODES = ["FILE_TOO_LARGE", "FILE_TYPE_NOT_ALLOWED", "FILE_SIGNATURE_MISMATCH", "FILE_CORRUPT", "FILE_EMPTY", "FILE_DUPLICATE_WARNING", "STORAGE_UNAVAILABLE", "FILE_ACTIVE_CONTENT", "UPLOAD_LIMIT_REACHED"] as const;
export type DocumentErrorCode = (typeof DOCUMENT_ERROR_CODES)[number];

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}
export function fileFamilyOf(name: string): (typeof DOCUMENT_FILE_TYPE_TABLE)[number]["family"] | null {
  return DOCUMENT_FILE_TYPE_TABLE.find((t) => t.ext === fileExtension(name))?.family ?? null;
}

/** Not AI: extension/name keywords plus the entity the user is uploading from. The user always confirms. */
export function suggestCategory(fileName: string, context?: { from?: "inspection" | "payment" | "asset" | "contractor" }): string {
  if (context?.from === "inspection") return "INSPECTION_REPORT";
  if (context?.from === "payment") return "PAYMENT_EVIDENCE";
  if (context?.from === "asset") return /maint|repair|service/i.test(fileName) ? "MAINTENANCE_DOCUMENT" : "ASSET_HANDOVER_RECORD";
  const n = fileName.toLowerCase();
  const rules: [RegExp, string][] = [
    [/contract|agreement/, "CONTRACT"], [/tender|bid/, "TENDER"], [/\bboq\b|bill.?of.?quant/, "BOQ"], [/invoice|receipt|payment|voucher/, "PAYMENT_EVIDENCE"], [/budget/, "BUDGET_DOCUMENT"],
    [/inspect/, "INSPECTION_REPORT"], [/drawing|blueprint|\bdwg\b|plan.?view/, "ENGINEERING_DRAWING"], [/proposal/, "PROJECT_PROPOSAL"], [/progress/, "PROGRESS_REPORT"],
    [/complet|handover/, "COMPLETION_REPORT"], [/approval|permit|licen[cs]e/, "APPROVAL_DOCUMENT"], [/letter|correspond|circular/, "GOVERNMENT_CORRESPONDENCE"], [/maint/, "MAINTENANCE_DOCUMENT"], [/plan|schedule/, "PROJECT_PLAN"],
  ];
  for (const [rx, key] of rules) if (rx.test(n)) return key;
  return fileFamilyOf(fileName) === "image" ? "SITE_EVIDENCE" : "OTHER";
}
