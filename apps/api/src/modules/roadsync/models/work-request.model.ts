import mongoose, { Schema } from "mongoose";
import { dateOrder, reference } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { WORKING_HOURS, WORK_PRIORITIES, WORK_STATUSES, WORK_TYPES } from "../roadsync.constants.js";

/** Server-owned detection summary (Steps 68-69). Never accepted from clients. */
const detectionSchema = new Schema({
  status: { type: String, enum: ["pending", "running", "completed", "failed"], required: true, default: "pending" },
  startedAt: { type: Date },
  completedAt: { type: Date },
  counts: {
    type: new Schema({ nearby: Number, candidates: Number, agencies: Number, truncated: Boolean }, { _id: false, strict: "throw" }),
  },
  error: { type: String, maxlength: 200 },
  runBy: { type: String, maxlength: 40 },
  sourcesChecked: {
    type: [new Schema({ source: String, ok: Boolean, error: { type: String, maxlength: 200 } }, { _id: false, strict: "throw" })],
    default: undefined,
  },
}, { _id: false, strict: "throw" });

const workRequestSchema = new Schema({
  projectId: reference("Project"),
  agencyId: reference("Agency"),
  geometry: geometryField(true),
  workType: { type: String, enum: WORK_TYPES, required: true },
  plannedStart: { type: Date, required: true },
  plannedEnd: { type: Date, required: true },
  status: { type: String, enum: WORK_STATUSES, required: true, default: "DRAFT" },
  priority: { type: String, enum: WORK_PRIORITIES, required: true, default: "NORMAL" },
  detection: { type: detectionSchema },
  /** Steps 70-71, server-owned (never accepted from clients): status, counts, riskIndex, maxBand, corridorProfile. */
  assessment: { type: Schema.Types.Mixed, default: undefined },
  /** Step 73, server-owned: { total, open, acknowledged, needsAck } of related conflict records. */
  conflictRecords: { type: Schema.Types.Mixed, default: undefined },
  /** Step 74-75, server-owned: { active, needsMyResponse } for the owning agency. */
  coordination: { type: Schema.Types.Mixed, default: undefined },
  /** Optional on existing documents (no migration): absent reads as "day". Changed after submit only by applyAmendmentToRequest. */
  schedule: { type: new Schema({ workingHours: { type: String, enum: WORKING_HOURS, default: "day" } }, { _id: false, strict: "throw" }), default: undefined },
  /** Step 76, server-owned (never client-accepted): written ONLY by applyAmendmentToRequest. */
  originalSchedule: { type: Schema.Types.Mixed, default: undefined },
  revisions: { type: [Schema.Types.Mixed], default: undefined },
  amendedCount: { type: Number, default: undefined },
  lastAmendedAt: { type: Date, default: undefined },
},{ timestamps: true, strict: "throw", collection: "workRequests" });

dateOrder(workRequestSchema, "plannedStart", "plannedEnd");

workRequestSchema.index({ agencyId: 1, status: 1, plannedStart: 1, plannedEnd: 1 });
workRequestSchema.index({ geometry: "2dsphere", status: 1, plannedStart: 1, plannedEnd: 1 });

export type WorkRequestDocument = mongoose.InferSchemaType<typeof workRequestSchema> & { _id: mongoose.Types.ObjectId };
export const WorkRequest = (mongoose.models.WorkRequest as mongoose.Model<WorkRequestDocument> | undefined) ?? mongoose.model<WorkRequestDocument>("WorkRequest", workRequestSchema);
