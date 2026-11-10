import mongoose, { Schema } from "mongoose";
import { dateOrder, locationSchema, moneySchema, percentage, reference, textField } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { PROJECT_STATUSES, PROJECT_TYPES } from "../project.constants.js";
import { RISK_LEVELS } from "@infraos/shared-types";

const projectSchema = new Schema({
  projectCode: { ...textField(48, true), immutable: true, unique: true, match: /^INF-[A-Z_]+-[0-9]+$/ },
  title: textField(200, true),
  description: textField(5000),
  projectType: { type: String, enum: PROJECT_TYPES, required: true },
  agencyId: reference("Agency"),
  managerId: reference("User", false),
  contractorId: reference("Contractor", false),
  location: { type: locationSchema },
  geometry: geometryField(),
  startDate: { type: Date },
  plannedEndDate: { type: Date },
  actualEndDate: { type: Date },
  budget: { type: moneySchema, required: true },
  physicalProgress: { ...percentage(), required: true, default: 0 },
  // Cache derived from PAID payments / budget by the future Finance service.
  financialProgress: { ...percentage(), required: true, default: 0 },
  status: { type: String, enum: PROJECT_STATUSES, required: true, default: "DRAFT" },
  /** Bumped by every budget-affecting finance write so concurrent writers per project conflict instead of racing. */
  financeVersion: { type: Number, min: 0 },
  // Cache written only by an approved inspection verification (Batch 06). Never derived from, and never overwrites, physicalProgress.
  verifiedProgress: { type: new Schema({ percent: { ...percentage(), required: true }, asOf: { type: Date, required: true }, verificationId: { type: Schema.Types.ObjectId, required: true } }, { _id: false, strict: "throw" }) },
  // Latest assessment summary only; absence means not assessed.
  riskScore: percentage(),
  // Server-owned risk intelligence cache (Step 119-123). Never client-writable.
  riskLevel: { type: String, enum: RISK_LEVELS, required: false },
  riskAssessedAt: { type: Date, required: false },
  latestRiskAssessmentId: reference("RiskAssessment", false),
  createdBy: reference("User"),
}, { timestamps: true, strict: "throw", collection: "projects" });

dateOrder(projectSchema, "startDate", "plannedEndDate");
dateOrder(projectSchema, "startDate", "actualEndDate");

projectSchema.index({ agencyId: 1, status: 1, plannedEndDate: 1 });
projectSchema.index({ status: 1, plannedEndDate: 1 });
projectSchema.index({ managerId: 1, status: 1 });
projectSchema.index({ contractorId: 1, status: 1 });
projectSchema.index({ projectType: 1, status: 1 });
projectSchema.index({ geometry: "2dsphere" });
// InfraMap district filter and district facet.
projectSchema.index({ "location.district": 1 });
projectSchema.index({ agencyId: 1, riskLevel: 1 });
projectSchema.index({ riskLevel: 1, riskAssessedAt: 1 });

export type ProjectDocument = mongoose.InferSchemaType<typeof projectSchema> & { _id: mongoose.Types.ObjectId };
export const Project = (mongoose.models.Project as mongoose.Model<ProjectDocument> | undefined) ?? mongoose.model<ProjectDocument>("Project", projectSchema);
