import type { AiIneligibleReason } from "@infraos/shared-types";

export type AiEligibilityInput = {
  origin?: string | null;
  status?: string | null;
  deletedAt?: Date | null;
  aiProcessingAllowed?: boolean | null;
  aiEligibleType?: boolean | null;
  confidentiality?: string | null;
  hasFile: boolean;
};
export type AiEligibility = { eligible: true } | { eligible: false; reasonCode: AiIneligibleReason };

/**
 * Pure policy. Images and XLSX are never eligible (aiEligibleType). SENSITIVE documents are processed only when processing was
 * explicitly allowed (a GOV_ADMIN decision in Batch 08); everything else defaults to excluded. Archived/deleted/draft are never indexed.
 */
export function isEligibleForAi(d: AiEligibilityInput, opts: { aiEnabled?: boolean } = {}): AiEligibility {
  if ((d.origin ?? "DOCTRACE") !== "DOCTRACE") return { eligible: false, reasonCode: "NOT_DOCTRACE" };
  if (d.deletedAt || d.status === "ARCHIVED" || d.status === "SUPERSEDED") return { eligible: false, reasonCode: "ARCHIVED" };
  if (d.status !== "ACTIVE") return { eligible: false, reasonCode: d.status === "DRAFT" ? "DRAFT" : "ARCHIVED" };
  if (d.confidentiality === "SENSITIVE" && d.aiProcessingAllowed !== true) return { eligible: false, reasonCode: "SENSITIVE" };
  if (d.aiProcessingAllowed === false) return { eligible: false, reasonCode: "EXCLUDED" };
  if (d.aiEligibleType !== true) return { eligible: false, reasonCode: "NOT_ELIGIBLE_TYPE" };
  if (!d.hasFile) return { eligible: false, reasonCode: "NO_FILE" };
  if (opts.aiEnabled === false) return { eligible: false, reasonCode: "AI_DISABLED" };
  return { eligible: true };
}
