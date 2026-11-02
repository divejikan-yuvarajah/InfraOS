import mongoose, { Schema } from "mongoose";
import { reference } from "../../../shared/database/fields.js";
import { RECORD_STATUSES } from "../conflict-record.rules.js";

const side = { ref: String, title: String, agencyId: String, infrastructureType: String, workType: { type: String, default: null }, plannedStart: { type: Date, default: null }, plannedEnd: { type: Date, default: null }, workingHours: { type: String, enum: ["day", "night", "24h"], default: "day" } };

/**
 * Steps 72-73: one formal, numbered record per assessed pair. Server-owned; nothing here is accepted from clients.
 * Steps 74-77 extend `status`, `events` and `affectedAgencies[].ack` without reshaping the record.
 */
const recordSchema = new Schema({
  conflictNo: { type: String, required: true, match: /^RSC-\d{4}-\d{6}$/ },
  recordType: { type: String, enum: ["conflict", "opportunity"], required: true },
  candidateId: reference("RoadsyncCandidate"),
  pairKey: { type: String, required: true, maxlength: 120 },
  aType: { type: String, enum: ["work_request", "project", "asset"], required: true },
  aId: { type: Schema.Types.ObjectId, required: true },
  bType: { type: String, enum: ["work_request", "project", "asset"], required: true },
  bId: { type: Schema.Types.ObjectId, required: true },
  sides: { a: side, b: side },
  hotspot: { type: { type: String, enum: ["Point"], required: true }, coordinates: { type: [Number], required: true } },
  district: { type: String, default: null, maxlength: 80 },
  overlapWindow: { type: new Schema({ start: Date, end: Date }, { _id: false }), default: null },
  internal: { type: Boolean, default: false },
  severity: { type: Schema.Types.Mixed, required: true },
  belowThreshold: { type: Boolean, default: false },
  status: { type: String, enum: RECORD_STATUSES, required: true, default: "open" },
  statusReason: { type: String, default: null, maxlength: 500 },
  statusChangedAt: { type: Date },
  statusChangedBy: { type: Schema.Types.ObjectId, default: null },
  dismissedAt: { type: Schema.Types.Mixed, default: null },
  affectedAgencies: { type: [Schema.Types.Mixed], default: [] },
  agencyIds: { type: [Schema.Types.ObjectId], default: [] },
  lead: { type: Schema.Types.Mixed, default: null },
  /** Step 74-75, server-owned summary: { activeCount, agreedCount, noAgreementCount, lastActivityAt, state }. */
  coordination: { type: Schema.Types.Mixed, default: undefined },
  /** Step 76, server-owned summary: { state, id, no, type, outcome, resolvedAt, openCommitments }. */
  resolution: { type: Schema.Types.Mixed, default: undefined },
  /** Step 77, server-owned: head of the hash-chained case ledger. Advanced only by appendLedger. */
  ledgerHead: { type: Schema.Types.Mixed, default: undefined },
  watchers: { type: [Schema.Types.ObjectId], default: [] },
  notes: { type: [Schema.Types.Mixed], default: [] },
  events: { type: [Schema.Types.Mixed], default: [] },
  inputsHash: { type: String, maxlength: 64 },
  ruleVersion: { type: String, maxlength: 20 },
  version: { type: Number, required: true, default: 1 },
  closedAt: { type: Date, default: null },
}, { timestamps: true, strict: "throw", collection: "roadsync_conflicts", minimize: false });

recordSchema.index({ conflictNo: 1 }, { unique: true });
recordSchema.index({ candidateId: 1 }, { unique: true });
recordSchema.index({ agencyIds: 1, status: 1, "severity.current.band": 1 });
recordSchema.index({ status: 1, "severity.current.score": -1 });
recordSchema.index({ "affectedAgencies.agencyId": 1, "affectedAgencies.ack.status": 1, status: 1 });
recordSchema.index({ aId: 1 });
recordSchema.index({ bId: 1 });
recordSchema.index({ "overlapWindow.start": 1 });
recordSchema.index({ hotspot: "2dsphere" });
recordSchema.index({ "lead.agencyId": 1 });

export type RecordDocument = mongoose.InferSchemaType<typeof recordSchema> & { _id: mongoose.Types.ObjectId };
export const ConflictRecord = (mongoose.models.RoadsyncConflictRecord as mongoose.Model<RecordDocument> | undefined) ?? mongoose.model<RecordDocument>("RoadsyncConflictRecord", recordSchema);

/** "Since you last looked": one marker per (record, user). No websockets. */
const readSchema = new Schema({
  conflictId: reference("RoadsyncConflictRecord"),
  userId: reference("User"),
  lastSeenAt: { type: Date, required: true },
  lastSeenVersion: { type: Number, default: 0 },
  snapshot: { type: Schema.Types.Mixed, default: null },
}, { timestamps: false, strict: "throw", collection: "roadsync_conflict_reads" });
readSchema.index({ conflictId: 1, userId: 1 }, { unique: true });
export const ConflictRead = (mongoose.models.RoadsyncConflictRead as mongoose.Model<mongoose.InferSchemaType<typeof readSchema>> | undefined) ?? mongoose.model("RoadsyncConflictRead", readSchema);

/** Atomic sequence per key (e.g. "RSC-2026"). Never derived from a count. */
const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, required: true, default: 0 } }, { strict: "throw", collection: "roadsync_counters" });
export const RoadsyncCounter = (mongoose.models.RoadsyncCounter as mongoose.Model<{ _id: string; seq: number }> | undefined) ?? mongoose.model<{ _id: string; seq: number }>("RoadsyncCounter", counterSchema);

export async function nextConflictNo(now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const row = await RoadsyncCounter.findOneAndUpdate({ _id: `RSC-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return `RSC-${year}-${String(row!.seq).padStart(6, "0")}`;
}
