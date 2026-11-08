import { DOCUMENT_CATEGORIES, categoryDef, fileFamilyOf, type DocumentCategoryDef, type DocumentLinkKey, type LegacyDocumentType } from "@infraos/shared-types";

export { DOCUMENT_CATEGORIES, categoryDef };

/** Single mapping category -> legacy `documentType`, so existing readers of `documentType` keep working. */
export const legacyTypeFor = (category: string): LegacyDocumentType => categoryDef(category)?.legacyDocumentType ?? "OTHER";

export type LinkInput = Partial<Record<DocumentLinkKey, string | null | undefined>>;

/** Server-side link rules table: a link is only legal for categories that declare it. Returns the offending key, or null when all links are allowed. */
export function illegalLink(category: string, links: LinkInput): DocumentLinkKey | null {
  const def = categoryDef(category);
  if (!def) return "contractorId";
  for (const [key, value] of Object.entries(links) as [DocumentLinkKey, string | null | undefined][]) {
    if (value && !def.links.includes(key)) return key;
  }
  return null;
}

export const categoryNeedsProject = (category: string): boolean => categoryDef(category)?.requiresProject ?? true;

/** Not AI: extension/name keywords plus the entity the user is uploading from. The user always confirms. */
export function suggestCategory(fileName: string, context?: { from?: "inspection" | "payment" | "asset" | "contractor" }): DocumentCategoryDef["key"] {
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

export const aiEligibleFor = (mime: string): boolean => ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime);
