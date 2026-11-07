import mongoose, { Schema } from "mongoose";
import { arrayLimit, nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";
import {
  CONTRACTOR_CATEGORIES, CONTRACTOR_CERT_STATUSES, CONTRACTOR_DOCUMENT_TYPES, CONTRACTOR_RISK_LEVELS, CONTRACTOR_STATUSES, SRI_LANKA_DISTRICTS,
} from "../contractor.constants.js";

const contactSchema = new Schema({
  contactPersonName: textField(120),
  email: { ...textField(254), lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phone: textField(32),
  address: textField(500),
}, { _id: false, strict: "throw" });

/** taxId is sensitive: manage tier only, never audited, never in a list projection. */
const businessSchema = new Schema({
  legalName: textField(200),
  taxId: textField(40),
  registrationAuthority: textField(80),
  cidaGrade: textField(20),
  registeredOn: { type: Date },
}, { _id: false, strict: "throw" });

/** VALID is derived to EXPIRED on read when expiresOn has passed; only REVOKED is a manual state. */
const certificationSchema = new Schema({
  name: textField(160, true),
  issuer: textField(160),
  referenceNumber: textField(80),
  issuedOn: { type: Date },
  expiresOn: { type: Date },
  status: { type: String, enum: CONTRACTOR_CERT_STATUSES, required: true, default: "VALID" },
  revokedReason: textField(500),
}, { strict: "throw" });

/** References only. No file is stored by this batch (file storage belongs to Batch 06). */
const documentRefSchema = new Schema({
  type: { type: String, enum: CONTRACTOR_DOCUMENT_TYPES, required: true },
  title: textField(200, true),
  referenceNumber: textField(80),
  documentId: reference("Document", false),
  notes: textField(500),
}, { strict: "throw" });

const contractorSchema = new Schema({
  name: textField(200, true),
  registrationNumber: { ...textField(80, true), uppercase: true, unique: true, match: /^[A-Z0-9][A-Z0-9/-]*$/ },
  /** The agency that registered and owns the record. The service requires it for new records; unset on an unbackfilled legacy row means platform-registered. */
  registeredByAgencyId: reference("Agency", false),
  category: { type: String, enum: CONTRACTOR_CATEGORIES },
  specializations: { type: [textField(60)], default: [], validate: arrayLimit(12) },
  operatingDistricts: { type: [{ type: String, enum: SRI_LANKA_DISTRICTS }], default: [], validate: arrayLimit(25) },
  contact: { type: contactSchema },
  business: { type: businessSchema },
  certifications: { type: [certificationSchema], default: [], validate: arrayLimit(20) },
  documentRefs: { type: [documentRefSchema], default: [], validate: arrayLimit(30) },
  // Server-owned duplicate keys. Only taxIdKey is unique (sparse); name and email keys drive warnings, not blocks.
  nameKey: textField(200),
  taxIdKey: textField(60),
  emailKey: textField(254),
  /** @deprecated legacy cache. Unverified, never written or displayed by the contractor module. */
  rating: { type: Number, min: 0, max: 5 },
  /** @deprecated legacy cache. Optional, not counters updated by hooks. Missing means unknown. */
  activeProjects: nonNegativeInteger(),
  /** @deprecated legacy cache. */
  completedProjects: nonNegativeInteger(),
  /** @deprecated legacy cache. Risk is now computed from evidence on read. */
  riskLevel: { type: String, enum: CONTRACTOR_RISK_LEVELS },
  status: { type: String, enum: CONTRACTOR_STATUSES, required: true, default: "ACTIVE" },
  statusReason: textField(500),
  statusChangedAt: { type: Date },
  statusChangedBy: reference("User", false),
  archivedAt: { type: Date },
}, { timestamps: true, strict: "throw", collection: "contractors" });

contractorSchema.index({ taxIdKey: 1 }, { unique: true, sparse: true });
contractorSchema.index({ registeredByAgencyId: 1, status: 1 });
contractorSchema.index({ category: 1, status: 1 });
contractorSchema.index({ operatingDistricts: 1 });
contractorSchema.index({ nameKey: 1 });
contractorSchema.index({ emailKey: 1 });
contractorSchema.index({ "certifications.expiresOn": 1 });

export type ContractorDocument = mongoose.InferSchemaType<typeof contractorSchema> & { _id: mongoose.Types.ObjectId };
export const Contractor = (mongoose.models.Contractor as mongoose.Model<ContractorDocument> | undefined) ?? mongoose.model<ContractorDocument>("Contractor", contractorSchema);
