import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, textField } from "../../../shared/database/fields.js";
import { CONTRACTOR_RISK_LEVELS, CONTRACTOR_STATUSES } from "../contractor.constants.js";

const contactSchema = new Schema({
  email: { ...textField(254), lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  phone: textField(32),
  address: textField(500),
}, { _id: false, strict: "throw" });

const contractorSchema = new Schema({
  name: textField(200, true),
  registrationNumber: { ...textField(80, true), uppercase: true, match: /^[A-Z0-9][A-Z0-9/-]*$/ },
  contact: { type: contactSchema },
  rating: { type: Number, min: 0, max: 5 },
  // Optional caches, not counters updated by schema hooks. Missing means unknown.
  activeProjects: nonNegativeInteger(),
  completedProjects: nonNegativeInteger(),
  riskLevel: { type: String, enum: CONTRACTOR_RISK_LEVELS },
  status: { type: String, enum: CONTRACTOR_STATUSES, required: true, default: "ACTIVE" },
}, { timestamps: true, strict: "throw", collection: "contractors" });

export type ContractorDocument = mongoose.InferSchemaType<typeof contractorSchema> & { _id: mongoose.Types.ObjectId };
export const Contractor = (mongoose.models.Contractor as mongoose.Model<ContractorDocument> | undefined) ?? mongoose.model<ContractorDocument>("Contractor", contractorSchema);
