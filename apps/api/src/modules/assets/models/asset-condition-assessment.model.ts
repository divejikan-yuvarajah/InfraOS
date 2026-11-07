import mongoose, { Schema } from "mongoose";
import { arrayLimit, reference, textField } from "../../../shared/database/fields.js";
import { ASSESSMENT_BASES, ASSESSMENT_STATUSES, ASSET_CONDITIONS, ISSUE_SEVERITIES, ISSUE_STATUSES, KNOWN_CONDITIONS } from "../asset.constants.js";

const issue = new Schema({
  key: { type: String, required: true, trim: true, maxlength: 60, match: /^[a-z0-9_]+$/ }, title: textField(160, true),
  severity: { type: String, enum: ISSUE_SEVERITIES, required: true }, status: { type: String, enum: ISSUE_STATUSES, required: true, default: "OPEN" }, location: textField(200),
}, { _id: false, strict: "throw" });

/** Append-only condition record. Only `status`/`supersededBy` may change. Condition changes only through one of these rows. */
const schema = new Schema({
  assetId: reference("Asset"), agencyId: reference("Agency"),
  assessedAt: { type: Date, required: true },
  condition: { type: String, enum: KNOWN_CONDITIONS, required: true },
  basis: { type: String, enum: ASSESSMENT_BASES, required: true },
  inspectionId: reference("Inspection", false),
  observations: textField(2000),
  issues: { type: [issue], default: [], validate: arrayLimit(20) },
  previousCondition: { type: String, enum: ASSET_CONDITIONS },
  assessedBy: reference("User"), reviewedBy: reference("User", false),
  status: { type: String, enum: ASSESSMENT_STATUSES, required: true, default: "ACTIVE" },
  supersededBy: reference("AssetConditionAssessment", false),
  maintenanceRefs: { type: [reference("MaintenanceRecord")], default: [], validate: arrayLimit(20) },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "assetConditionAssessments" });

const immutable = (): never => { throw new Error("AssetConditionAssessment is append-only"); };
schema.pre("save", function () { if (!this.isNew) immutable(); });
schema.pre(["replaceOne", "findOneAndReplace", "findOneAndDelete", "deleteOne", "deleteMany"], immutable);
schema.pre("bulkWrite", immutable);
schema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  const set = (this.getUpdate() as { $set?: Record<string, unknown> } | null)?.$set ?? {};
  const keys = Object.keys(set);
  if (!keys.length || keys.some((k) => k !== "status" && k !== "supersededBy")) immutable();
});

schema.index({ assetId: 1, assessedAt: -1 });
schema.index({ agencyId: 1, assessedAt: -1 });
schema.index({ inspectionId: 1 }, { unique: true, partialFilterExpression: { inspectionId: { $type: "objectId" } } });

export type AssetConditionAssessmentDocument = mongoose.InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const AssetConditionAssessment = (mongoose.models.AssetConditionAssessment as mongoose.Model<AssetConditionAssessmentDocument> | undefined) ?? mongoose.model<AssetConditionAssessmentDocument>("AssetConditionAssessment", schema);
