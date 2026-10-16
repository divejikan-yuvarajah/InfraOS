import mongoose, { Schema } from "mongoose";
import { dateOrder, reference } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { WORK_PRIORITIES, WORK_STATUSES, WORK_TYPES } from "../roadsync.constants.js";

const workRequestSchema = new Schema({
  projectId: reference("Project"),
  agencyId: reference("Agency"),
  geometry: geometryField(true),
  workType: { type: String, enum: WORK_TYPES, required: true },
  plannedStart: { type: Date, required: true },
  plannedEnd: { type: Date, required: true },
  status: { type: String, enum: WORK_STATUSES, required: true, default: "DRAFT" },
  priority: { type: String, enum: WORK_PRIORITIES, required: true, default: "NORMAL" },
}, { timestamps: true, strict: "throw", collection: "workRequests" });

dateOrder(workRequestSchema, "plannedStart", "plannedEnd");

workRequestSchema.index({ agencyId: 1, status: 1, plannedStart: 1, plannedEnd: 1 });
workRequestSchema.index({ geometry: "2dsphere", status: 1, plannedStart: 1, plannedEnd: 1 });

export type WorkRequestDocument = mongoose.InferSchemaType<typeof workRequestSchema> & { _id: mongoose.Types.ObjectId };
export const WorkRequest = (mongoose.models.WorkRequest as mongoose.Model<WorkRequestDocument> | undefined) ?? mongoose.model<WorkRequestDocument>("WorkRequest", workRequestSchema);
