import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";
import { ISSUE_CATEGORIES } from "../issue.constants.js";

const issueRoutingRuleSchema = new Schema({
  category: { type: String, enum: ISSUE_CATEGORIES, required: true },
  province: textField(80),
  district: textField(80),
  agencyId: reference("Agency", true),
  priorityOrder: { ...nonNegativeInteger(), default: 100 },
  isActive: { type: Boolean, required: true, default: true },
  isDemo: { type: Boolean, default: false },
  createdBy: reference("User", false),
}, { timestamps: true, strict: "throw", collection: "issueRoutingRules" });

issueRoutingRuleSchema.index({ isActive: 1, category: 1, district: 1, priorityOrder: 1 });
issueRoutingRuleSchema.index({ agencyId: 1 });

export type IssueRoutingRuleDocument = mongoose.InferSchemaType<typeof issueRoutingRuleSchema> & { _id: mongoose.Types.ObjectId };
export const IssueRoutingRule =
  (mongoose.models.IssueRoutingRule as mongoose.Model<IssueRoutingRuleDocument> | undefined) ??
  mongoose.model<IssueRoutingRuleDocument>("IssueRoutingRule", issueRoutingRuleSchema);
