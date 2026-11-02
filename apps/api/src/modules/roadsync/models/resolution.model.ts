import mongoose, { Schema } from "mongoose";
import { reference } from "../../../shared/database/fields.js";
import { AMENDMENT_STATUSES, RESOLUTION_STATUSES, RESOLUTION_TYPES } from "../resolution.rules.js";

/**
 * Step 76: one resolution per conflict at a time (partial unique index on `active`). Server-owned; nothing is accepted
 * from clients. Plan, approvals, commitments, verification and events stay Mixed so the pure engine owns their shape.
 */
const resolutionSchema = new Schema({
  resolutionNo: { type: String, required: true, match: /^RSR-\d{4}-\d{6}$/ },
  conflictId: reference("RoadsyncConflictRecord"),
  conflictNo: { type: String, required: true, maxlength: 20 },
  pairKey: { type: String, required: true, maxlength: 120 },
  type: { type: String, enum: RESOLUTION_TYPES, required: true },
  source: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: RESOLUTION_STATUSES, required: true, default: "draft" },
  /** true while the resolution holds the conflict's single active slot. */
  active: { type: Boolean, required: true, default: true },
  contested: { type: Schema.Types.Mixed, default: null },
  initiator: { type: Schema.Types.Mixed, required: true },
  plan: { type: Schema.Types.Mixed, default: {} },
  approvals: { type: [Schema.Types.Mixed], default: [] },
  commitments: { type: [Schema.Types.Mixed], default: [] },
  verification: { type: Schema.Types.Mixed, default: null },
  outcome: { type: Schema.Types.Mixed, default: null },
  events: { type: [Schema.Types.Mixed], default: [] },
  version: { type: Number, required: true, default: 1 },
  closedAt: { type: Date, default: null },
}, { timestamps: true, strict: "throw", collection: "roadsync_resolutions", minimize: false });

resolutionSchema.index({ resolutionNo: 1 }, { unique: true });
resolutionSchema.index({ conflictId: 1 }, { unique: true, partialFilterExpression: { active: true } });
resolutionSchema.index({ conflictId: 1, createdAt: -1 });
resolutionSchema.index({ "approvals.status": 1, "approvals.agencyId": 1, "approvals.step": 1 });
resolutionSchema.index({ status: 1, updatedAt: -1 });
export type ResolutionDocument = mongoose.InferSchemaType<typeof resolutionSchema> & { _id: mongoose.Types.ObjectId };
export const Resolution = (mongoose.models.RoadsyncResolution as mongoose.Model<ResolutionDocument> | undefined) ?? mongoose.model<ResolutionDocument>("RoadsyncResolution", resolutionSchema);

const amendmentSchema = new Schema({
  amendmentNo: { type: String, required: true, match: /^RSA-\d{4}-\d{6}$/ },
  resolutionId: reference("RoadsyncResolution"),
  conflictId: reference("RoadsyncConflictRecord"),
  workRequestId: reference("WorkRequest"),
  agencyId: reference("Agency"),
  source: { type: Schema.Types.Mixed, required: true },
  mandated: { type: Boolean, default: false },
  baseVersion: { type: Number, required: true },
  changes: { type: Schema.Types.Mixed, required: true },
  impact: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: AMENDMENT_STATUSES, required: true, default: "draft" },
  createdBy: { type: Schema.Types.Mixed, required: true },
  submittedBy: { type: Schema.Types.Mixed, default: null },
  appliedAt: { type: Date, default: null },
  appliedBy: { type: Schema.Types.Mixed, default: null },
  appliedVersion: { type: Number, default: null },
  preflightLast: { type: Schema.Types.Mixed, default: null },
  version: { type: Number, required: true, default: 1 },
}, { timestamps: true, strict: "throw", collection: "roadsync_amendments", minimize: false });
amendmentSchema.index({ amendmentNo: 1 }, { unique: true });
amendmentSchema.index({ resolutionId: 1 });
amendmentSchema.index({ workRequestId: 1, status: 1 });
amendmentSchema.index({ agencyId: 1, status: 1 });
export type AmendmentDocument = mongoose.InferSchemaType<typeof amendmentSchema> & { _id: mongoose.Types.ObjectId };
export const Amendment = (mongoose.models.RoadsyncAmendment as mongoose.Model<AmendmentDocument> | undefined) ?? mongoose.model<AmendmentDocument>("RoadsyncAmendment", amendmentSchema);

/** Step 77: append-only, hash-chained per conflict. No update or delete code path exists for this collection. */
const ledgerSchema = new Schema({
  conflictId: reference("RoadsyncConflictRecord"),
  seq: { type: Number, required: true, min: 1 },
  at: { type: Date, required: true },
  recordedAt: { type: Date, required: true },
  entityType: { type: String, required: true, maxlength: 20 },
  entityId: { type: String, required: true, maxlength: 80 },
  entityNo: { type: String, default: null, maxlength: 24 },
  action: { type: String, required: true, maxlength: 50 },
  actor: { type: Schema.Types.Mixed, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  visibility: { type: String, enum: ["participants", "agency", "national"], required: true },
  visibilityAgencyId: { type: String, default: null },
  stateAfter: { type: Schema.Types.Mixed, required: true },
  prevHash: { type: String, required: true, maxlength: 64 },
  hash: { type: String, required: true, maxlength: 64 },
}, { strict: "throw", collection: "roadsync_ledger", minimize: false });
ledgerSchema.index({ conflictId: 1, seq: 1 }, { unique: true });
ledgerSchema.index({ conflictId: 1, at: 1 });
ledgerSchema.index({ entityType: 1, action: 1, at: -1 });
ledgerSchema.index({ "actor.agencyId": 1, at: -1 });
export type LedgerDocument = mongoose.InferSchemaType<typeof ledgerSchema> & { _id: mongoose.Types.ObjectId };
export const LedgerEntry = (mongoose.models.RoadsyncLedger as mongoose.Model<LedgerDocument> | undefined) ?? mongoose.model<LedgerDocument>("RoadsyncLedger", ledgerSchema);
