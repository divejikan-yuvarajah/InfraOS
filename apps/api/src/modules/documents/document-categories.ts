import { DOCUMENT_CATEGORIES, categoryDef, suggestCategory, type DocumentLinkKey, type LegacyDocumentType } from "@infraos/shared-types";

/** `suggestCategory` lives in shared-types so the API and the upload wizard use one rule set. */
export { DOCUMENT_CATEGORIES, categoryDef, suggestCategory };

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

export const aiEligibleFor = (mime: string): boolean => ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mime);
