import mongoose, { Schema } from "mongoose";
import { dateOrder, locationSchema, moneySchema, percentage, reference, textField } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { PROJECT_STATUSES, PROJECT_TYPES } from "../project.constants.js";

const projectSchema = new Schema({
  projectCode: { ...textField(48, true), immutable: true, match: /^INF-[A-Z_]+-[0-9]+$/ },
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
  // Latest assessment summary only; absence means not assessed.
  riskScore: percentage(),
  createdBy: reference("User"),
}, { timestamps: true, strict: "throw", collection: "projects" });

dateOrder(projectSchema, "startDate", "plannedEndDate");

export type ProjectDocument = mongoose.InferSchemaType<typeof projectSchema> & { _id: mongoose.Types.ObjectId };
export const Project = (mongoose.models.Project as mongoose.Model<ProjectDocument> | undefined) ?? mongoose.model<ProjectDocument>("Project", projectSchema);
