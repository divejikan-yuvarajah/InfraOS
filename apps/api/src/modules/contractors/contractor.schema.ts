import { z } from "zod";

import { ASSIGNMENT_ROLES, CONTRACTOR_CATEGORIES, CONTRACTOR_CERT_STATUSES, CONTRACTOR_DOCUMENT_TYPES, CONTRACTOR_STATUSES, SRI_LANKA_DISTRICTS } from "./contractor.constants.js";

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const noControl = (value: string) => !hasControlChar(value);
export const text = (max: number) => z.string().trim().min(1).max(max).refine(noControl, "text contains control characters");
const optText = (max: number) => z.string().trim().max(max).refine(noControl, "text contains control characters").optional();
export const reasonText = z.string().trim().min(12).max(500).refine(noControl, "text contains control characters");
const day = z.coerce.date();
const iso = z.string().datetime({ offset: true });

const registrationNumber = z.string().trim().min(1).max(80).transform((v) => v.toUpperCase()).refine((v) => /^[A-Z0-9][A-Z0-9/-]*$/.test(v), "invalid registration number");
const email = z.string().trim().email().max(254);
const districts = z.array(z.enum(SRI_LANKA_DISTRICTS as unknown as [string, ...string[]])).max(25).refine((a) => new Set(a).size === a.length, "duplicate district");
const specializations = z.array(text(60)).max(12);

const contact = z.object({ contactPersonName: optText(120), email: email.optional(), phone: optText(32), address: optText(500) }).strict();
const business = z.object({ legalName: optText(200), taxId: optText(40), registrationAuthority: optText(80), cidaGrade: optText(20), registeredOn: day.optional() }).strict();

const certBody = z.object({ name: text(160), issuer: optText(160), referenceNumber: optText(80), issuedOn: day.optional(), expiresOn: day.optional() }).strict()
  .refine((c) => !c.issuedOn || !c.expiresOn || c.expiresOn >= c.issuedOn, { message: "expiresOn must be on or after issuedOn", path: ["expiresOn"] });
const docRefBody = z.object({ type: z.enum(CONTRACTOR_DOCUMENT_TYPES), title: text(200), referenceNumber: optText(80), documentId: objectId.optional(), notes: optText(500) }).strict();

export const contractorCreateSchema = z.object({
  name: text(200), registrationNumber, category: z.enum(CONTRACTOR_CATEGORIES), specializations: specializations.default([]), operatingDistricts: districts.default([]),
  contact: contact.optional(), business: business.optional(),
  certifications: z.array(certBody).max(20).default([]), documentRefs: z.array(docRefBody).max(30).default([]),
  agencyId: objectId.optional(),
  confirmNotDuplicate: z.boolean().optional(), duplicateAcknowledgement: z.string().trim().min(12).max(500).refine(noControl).optional(),
}).strict();

export const contractorPatchSchema = z.object({
  expectedUpdatedAt: iso,
  name: text(200).optional(), category: z.enum(CONTRACTOR_CATEGORIES).optional(), specializations: specializations.optional(), operatingDistricts: districts.optional(),
  contact: contact.optional(), business: business.optional(),
  registrationNumber: registrationNumber.optional(), registrationNumberReason: reasonText.optional(),
}).strict().refine((v) => Object.keys(v).some((k) => k !== "expectedUpdatedAt" && k !== "registrationNumberReason"), { message: "nothing to update" })
  .refine((v) => !v.registrationNumber || !!v.registrationNumberReason, { message: "a reason is required to change the registration number", path: ["registrationNumberReason"] });

export const statusBodySchema = z.object({
  status: z.enum(CONTRACTOR_STATUSES), reason: reasonText.optional(), acknowledgeImpact: z.boolean().optional(), expectedUpdatedAt: iso.optional(),
}).strict();

export const certCreateSchema = certBody;
export const certPatchSchema = z.object({ name: text(160).optional(), issuer: optText(160), referenceNumber: optText(80), issuedOn: day.optional(), expiresOn: day.optional() }).strict()
  .refine((v) => Object.keys(v).length > 0, "nothing to update")
  .refine((v) => !v.issuedOn || !v.expiresOn || v.expiresOn >= v.issuedOn, { message: "expiresOn must be on or after issuedOn", path: ["expiresOn"] });
export const certRevokeSchema = z.object({ reason: reasonText }).strict();
export const docRefCreateSchema = docRefBody;

export const duplicateCheckSchema = z.object({
  registrationNumber: registrationNumber.optional(), name: z.string().trim().min(2).max(200).optional(), taxId: z.string().trim().min(1).max(40).optional(), email: email.optional(), excludeId: objectId.optional(),
}).strict().refine((v) => !!(v.registrationNumber || v.name || v.taxId || v.email), "provide at least one field");

const csv = <T extends string>(allowed: readonly T[]) => z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.enum(allowed as unknown as [T, ...T[]])).max(allowed.length));
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const intIn = (min: number, max: number) => z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(min).max(max));

export const RISK_BANDS = ["STRONG", "MIXED", "WEAK", "NOT_ENOUGH_EVIDENCE"] as const;
export const SORTS = ["name", "registeredAt", "activeProjects", "risk"] as const;

/** Every value must be a single string: a repeated key arrives as an array and is rejected, as is any unknown key. */
export const contractorListQuerySchema = z.object({
  q: z.string().trim().max(100).refine(noControl).optional(),
  status: csv(CONTRACTOR_STATUSES).optional(),
  category: z.enum(CONTRACTOR_CATEGORIES).optional(),
  district: z.enum(SRI_LANKA_DISTRICTS as unknown as [string, ...string[]]).optional(),
  agencyId: objectId.optional(),
  riskBand: z.enum(RISK_BANDS).optional(),
  certExpiringDays: z.enum(["30", "60", "90", "expired"]).optional(),
  hasActiveProjects: bool.optional(),
  sort: z.enum(SORTS).default("name"),
  page: intIn(1, 10_000).default(1),
  limit: intIn(1, 50).default(20),
}).strict();

export type ContractorListQuery = z.infer<typeof contractorListQuerySchema>;
export type ContractorCreateInput = z.infer<typeof contractorCreateSchema>;
export type ContractorPatchInput = z.infer<typeof contractorPatchSchema>;
export type StatusBody = z.infer<typeof statusBodySchema>;

export const assignBodySchema = z.object({
  contractorId: objectId, role: z.enum(ASSIGNMENT_ROLES), startDate: day, contractReference: optText(80),
  contractValueMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(), notes: optText(1000),
}).strict();
export const endBodySchema = z.object({
  status: z.enum(["ENDED", "TERMINATED"]), endDate: day, endReason: reasonText, promoteAssignmentId: objectId.optional(),
}).strict();
export const reassignBodySchema = z.object({
  newContractorId: objectId, effectiveDate: day, reason: reasonText, contractReference: optText(80),
  contractValueMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(), notes: optText(1000),
}).strict();
export type AssignBody = z.infer<typeof assignBodySchema>;
export type EndBody = z.infer<typeof endBodySchema>;
export type ReassignBody = z.infer<typeof reassignBodySchema>;

export const assignmentListQuerySchema = z.object({
  view: z.enum(["active", "completed", "all"]).default("all"), page: intIn(1, 10_000).default(1), limit: intIn(1, 50).default(20),
}).strict();
export const timelineQuerySchema = z.object({ cursor: z.string().regex(/^o\d{1,5}$/).optional(), limit: intIn(1, 50).default(20) }).strict();

/** Rejects repeated keys (arrays) and returns the parsed value or null. */
export function parseStrict<T>(schema: z.ZodType<T>, input: unknown): T | null {
  if (!input || typeof input !== "object") return null;
  for (const v of Object.values(input as Record<string, unknown>)) if (Array.isArray(v) || (v !== null && typeof v === "object")) return null;
  const out = schema.safeParse(input);
  return out.success ? out.data : null;
}

export const CERT_STATUS_VALUES = CONTRACTOR_CERT_STATUSES;
