import mongoose, { Schema } from "mongoose";
import { dateOrder, reference } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { WORK_PRIORITIES, WORK_STATUSES, WORK_TYPES } from "../roadsync.constants.js";

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
}, { timestamps: true, strict: "throw", collection: "workRequests" });

dateOrder(workRequestSchema, "plannedStart", "plannedEnd");

workRequestSchema.index({ agencyId: 1, status: 1, plannedStart: 1, plannedEnd: 1 });
workRequestSchema.index({ geometry: "2dsphere", status: 1, plannedStart: 1, plannedEnd: 1 });

export type WorkRequestDocument = mongoose.InferSchemaType<typeof workRequestSchema> & { _id: mongoose.Types.ObjectId };
export const WorkRequest = (mongoose.models.WorkRequest as mongoose.Model<WorkRequestDocument> | undefined) ?? mongoose.model<WorkRequestDocument>("WorkRequest", workRequestSchema);
