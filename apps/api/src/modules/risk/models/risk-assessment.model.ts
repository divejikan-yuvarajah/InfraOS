import mongoose, { Schema } from "mongoose";
import { arrayLimit, percentage, reference, textField } from "../../../shared/database/fields.js";
import { RISK_FACTOR_CATEGORIES } from "../risk.constants.js";

const factorSchema = new Schema({
  category: { type: String, enum: RISK_FACTOR_CATEGORIES, required: true },
  description: textField(1000, true),
  score: { ...percentage(), required: true },
}, { _id: false, strict: "throw" });

const riskAssessmentSchema = new Schema({
  projectId: reference("Project"),
  overallRisk: { ...percentage(), required: true },
  delayRisk: { ...percentage(), required: true },
  budgetRisk: { ...percentage(), required: true },
  scheduleRisk: { ...percentage(), required: true },
  factors: { type: [factorSchema], default: [], validate: arrayLimit(50) },
  recommendations: { type: [textField(1000, true)], default: [], validate: arrayLimit(20) },
  modelVersion: { ...textField(100, true), match: /^[A-Za-z0-9_.:-]+$/ },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "riskAssessments" });

export type RiskAssessmentDocument = mongoose.InferSchemaType<typeof riskAssessmentSchema> & { _id: mongoose.Types.ObjectId };
export const RiskAssessment = (mongoose.models.RiskAssessment as mongoose.Model<RiskAssessmentDocument> | undefined) ?? mongoose.model<RiskAssessmentDocument>("RiskAssessment", riskAssessmentSchema);
