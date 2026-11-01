import mongoose, { Schema } from "mongoose";
import { reference } from "../../../shared/database/fields.js";

/** One document per spatial+temporal PAIR (Steps 68-69). Steps 70+ consume `isCandidate`, `spatial` and `temporal`. */
const candidateSchema = new Schema({
  aType: { type: String, enum: ["work_request"], required: true },
  aId: reference("WorkRequest"),
  bType: { type: String, enum: ["work_request", "project", "asset"], required: true },
  bId: { type: Schema.Types.ObjectId, required: true },
  agencyIds: { type: [{ type: Schema.Types.ObjectId, ref: "Agency" }], required: true },
  aInfrastructureType: { type: String, required: true, maxlength: 40 },
  bInfrastructureType: { type: String, required: true, maxlength: 40 },
  spatial: { type: Schema.Types.Mixed, required: true },
  temporal: { type: Schema.Types.Mixed, required: true },
  isCandidate: { type: Boolean, required: true },
  status: { type: String, enum: ["active", "inactive"], required: true, default: "active" },
  inactiveReason: { type: String, enum: ["request_cancelled", "source_removed", "out_of_radius", "source_changed"], default: null },
  detectedAt: { type: Date, required: true },
  detectedBy: { type: String, required: true, maxlength: 40 },
  sourceUpdatedAt: { type: Date, default: null },
  inputsHash: { type: String, required: true, maxlength: 64 },
}, { timestamps: { createdAt: false, updatedAt: true }, strict: "throw", collection: "roadsync_candidates" });

candidateSchema.index({ aType: 1, aId: 1, bType: 1, bId: 1 }, { unique: true });
candidateSchema.index({ aId: 1, isCandidate: 1, status: 1 });
candidateSchema.index({ bType: 1, bId: 1, status: 1 });
candidateSchema.index({ agencyIds: 1, isCandidate: 1, status: 1 });
candidateSchema.index({ "spatial.distanceMeters": 1 });

export type CandidateDocument = mongoose.InferSchemaType<typeof candidateSchema> & { _id: mongoose.Types.ObjectId };
export const Candidate = (mongoose.models.RoadsyncCandidate as mongoose.Model<CandidateDocument> | undefined) ?? mongoose.model<CandidateDocument>("RoadsyncCandidate", candidateSchema);
