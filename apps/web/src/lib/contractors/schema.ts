import { z } from "zod";

import { CONTRACTOR_CATEGORIES, DOCUMENT_TYPES } from "./types";

/**
 * Registration/edit form schema, mirroring the server's limits (contractor.schema.ts). Messages are KEYS, not prose,
 * so the form can show them in the viewer's language; the server stays the authority and re-validates everything.
 */
export const LIMITS = { name: 200, registration: 80, text: 200, phone: 32, email: 254, address: 500, taxId: 40, authority: 80, grade: 20, specializations: 12, specializationLength: 60, districts: 25, certs: 20, docs: 30, note: 500 } as const;

const REG = /^[A-Z0-9][A-Z0-9/-]*$/;
const noControl = (v: string) => ![...v].some((c) => c.charCodeAt(0) <= 31 || c.charCodeAt(0) === 127);
const text = (max: number, required = false) => {
  const base = z.string().trim().max(max, "tooLong").refine(noControl, "control");
  return required ? base.min(1, "required") : base;
};
const day = z.string().trim().refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())), "date");

export const certificationRow = z.object({ name: text(160, true), issuer: text(160), referenceNumber: text(80), issuedOn: day, expiresOn: day })
  .refine((c) => !c.issuedOn || !c.expiresOn || c.expiresOn >= c.issuedOn, { message: "dateOrder", path: ["expiresOn"] });
export const documentRow = z.object({ type: z.enum(DOCUMENT_TYPES), title: text(200, true), referenceNumber: text(80), notes: text(LIMITS.note) });

export const basicsShape = {
  name: text(LIMITS.name, true),
  registrationNumber: z.string().trim().toUpperCase().min(1, "required").max(LIMITS.registration, "tooLong").regex(REG, "regPattern"),
  category: z.enum(CONTRACTOR_CATEGORIES, "required"),
  specializationsText: z.string().max(800, "tooLong").refine((v) => splitSpecializations(v).length <= LIMITS.specializations && splitSpecializations(v).every((s) => s.length <= LIMITS.specializationLength), "specializations"),
  operatingDistricts: z.array(z.string()).max(LIMITS.districts, "tooMany"),
};
export const contactShape = {
  contactPersonName: text(120),
  email: z.string().trim().max(LIMITS.email, "tooLong").refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "email"),
  phone: text(LIMITS.phone), address: text(LIMITS.address),
  legalName: text(LIMITS.name), taxId: text(LIMITS.taxId), registrationAuthority: text(LIMITS.authority), cidaGrade: text(LIMITS.grade), registeredOn: day,
};
export const extrasShape = {
  certifications: z.array(certificationRow).max(LIMITS.certs, "tooMany"),
  documentRefs: z.array(documentRow).max(LIMITS.docs, "tooMany"),
};
export const duplicateShape = { confirmNotDuplicate: z.boolean(), duplicateAcknowledgement: z.string().trim().max(LIMITS.note, "tooLong") };

export const contractorFormSchema = z.object({ ...basicsShape, ...contactShape, ...extrasShape, ...duplicateShape });
export type ContractorFormValues = z.infer<typeof contractorFormSchema>;

export const EMPTY_FORM: ContractorFormValues = {
  name: "", registrationNumber: "", category: "GENERAL", specializationsText: "", operatingDistricts: [],
  contactPersonName: "", email: "", phone: "", address: "", legalName: "", taxId: "", registrationAuthority: "", cidaGrade: "", registeredOn: "",
  certifications: [], documentRefs: [], confirmNotDuplicate: false, duplicateAcknowledgement: "",
};

/** The wizard steps and the fields each one owns, so "Next" validates only what the step shows. */
export const STEP_FIELDS = [
  ["name", "registrationNumber", "category", "specializationsText", "operatingDistricts"],
  ["contactPersonName", "email", "phone", "address", "legalName", "taxId", "registrationAuthority", "cidaGrade", "registeredOn"],
  ["certifications", "documentRefs"],
  ["confirmNotDuplicate", "duplicateAcknowledgement"],
] as const satisfies readonly (readonly (keyof ContractorFormValues)[])[];

export function splitSpecializations(value: string): string[] {
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
}

const opt = (v: string) => (v.trim() === "" ? undefined : v.trim());
const dropEmpty = <T extends Record<string, unknown>>(o: T): Partial<T> | undefined => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  return Object.keys(out).length ? (out as Partial<T>) : undefined;
};

/** Form values to the API body: empty strings become absent, dates stay yyyy-mm-dd. */
export function toRegisterBody(v: ContractorFormValues, extra?: { agencyId?: string }) {
  return {
    name: v.name.trim(), registrationNumber: v.registrationNumber.trim().toUpperCase(), category: v.category,
    specializations: splitSpecializations(v.specializationsText), operatingDistricts: v.operatingDistricts,
    contact: dropEmpty({ contactPersonName: opt(v.contactPersonName), email: opt(v.email), phone: opt(v.phone), address: opt(v.address) }),
    business: dropEmpty({ legalName: opt(v.legalName), taxId: opt(v.taxId), registrationAuthority: opt(v.registrationAuthority), cidaGrade: opt(v.cidaGrade), registeredOn: opt(v.registeredOn) }),
    certifications: v.certifications.map((c) => dropEmpty({ name: c.name.trim(), issuer: opt(c.issuer), referenceNumber: opt(c.referenceNumber), issuedOn: opt(c.issuedOn), expiresOn: opt(c.expiresOn) })),
    documentRefs: v.documentRefs.map((d) => dropEmpty({ type: d.type, title: d.title.trim(), referenceNumber: opt(d.referenceNumber), notes: opt(d.notes) })),
    ...(extra?.agencyId ? { agencyId: extra.agencyId } : {}),
    ...(v.confirmNotDuplicate && v.duplicateAcknowledgement.trim().length >= 12 ? { confirmNotDuplicate: true, duplicateAcknowledgement: v.duplicateAcknowledgement.trim() } : {}),
  };
}

/** Edit sends only the profile fields (certifications and documents have their own endpoints). Contact and business replace as a whole. */
export function toPatchBody(v: ContractorFormValues, expectedUpdatedAt: string, registrationNumberReason?: string, originalRegistration?: string) {
  const changedReg = originalRegistration !== undefined && v.registrationNumber.trim().toUpperCase() !== originalRegistration;
  return {
    expectedUpdatedAt, name: v.name.trim(), category: v.category, specializations: splitSpecializations(v.specializationsText), operatingDistricts: v.operatingDistricts,
    contact: dropEmpty({ contactPersonName: opt(v.contactPersonName), email: opt(v.email), phone: opt(v.phone), address: opt(v.address) }) ?? {},
    business: dropEmpty({ legalName: opt(v.legalName), taxId: opt(v.taxId), registrationAuthority: opt(v.registrationAuthority), cidaGrade: opt(v.cidaGrade), registeredOn: opt(v.registeredOn) }) ?? {},
    ...(changedReg ? { registrationNumber: v.registrationNumber.trim().toUpperCase(), registrationNumberReason } : {}),
  };
}

export const statusReasonSchema = z.string().trim().min(12, "reasonShort").max(500, "tooLong").refine(noControl, "control");
export const assignSchema = z.object({
  projectId: z.string().regex(/^[a-f0-9]{24}$/i, "required"), role: z.enum(["PRIMARY", "ADDITIONAL"]), startDate: day.refine((v) => v !== "", "required"),
  contractReference: text(80), contractValue: z.string().trim().refine((v) => v === "" || /^\d{1,13}(\.\d{1,2})?$/.test(v.replace(/,/g, "")), "money"), notes: text(1000),
});
export type AssignFormValues = z.infer<typeof assignSchema>;
