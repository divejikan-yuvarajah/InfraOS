import mongoose, { Schema } from "mongoose";
import { arrayLimit, reference, textField } from "../../../shared/database/fields.js";
import { VERIFICATION_STATUSES } from "../inspection.constants.js";

const int = { type: Number, min: 0, max: 100, validate: Number.isInteger };

/** Append-only verified-progress record. Only `status`/`supersededBy` may change. Never overwrites reported progress. */
const schema = new Schema({
  projectId: reference("Project"), agencyId: reference("Agency"), inspectionId: reference("Inspection"),
  submissionNo: { type: Number, required: true, min: 1 },
  verifiedPercent: { ...int, required: true },
  claimedPercent: { ...int, default: null },
  discrepancyPp: { type: Number, default: null, validate: (v: number | null) => v === null || Number.isInteger(v) },
  milestones: { type: [new Schema({ milestoneId: reference("Milestone"), claimedProgress: { type: Number, min: 0, max: 100 }, verifiedProgress: { ...int, required: true } }, { _id: false, strict: "throw" })], default: [], validate: arrayLimit(10) },
  inspectorId: reference("User"), reviewerId: reference("User"), asOf: { type: Date, required: true },
  status: { type: String, enum: VERIFICATION_STATUSES, required: true, default: "ACTIVE" },
  supersededBy: reference("ProgressVerification", false), note: textField(1000),
  contractorIds: { type: [reference("Contractor")], default: [], validate: arrayLimit(20) },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "progressVerifications" });

const immutable = (): never => { throw new Error("ProgressVerification is append-only"); };
schema.pre("save", function () { if (!this.isNew) immutable(); });
schema.pre(["replaceOne", "findOneAndReplace", "findOneAndDelete", "deleteOne", "deleteMany"], immutable);
schema.pre("bulkWrite", immutable);
// Updates are limited to the supersede fields.
schema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  const set = (this.getUpdate() as { $set?: Record<string, unknown> } | null)?.$set ?? {};
  const keys = Object.keys(set);
  if (!keys.length || keys.some((k) => k !== "status" && k !== "supersededBy")) immutable();
});

schema.index({ projectId: 1, status: 1, asOf: -1 });
schema.index({ inspectionId: 1 }, { unique: true });
schema.index({ contractorIds: 1, status: 1 });

export type ProgressVerificationDocument = mongoose.InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const ProgressVerification = (mongoose.models.ProgressVerification as mongoose.Model<ProgressVerificationDocument> | undefined) ?? mongoose.model<ProgressVerificationDocument>("ProgressVerification", schema);
