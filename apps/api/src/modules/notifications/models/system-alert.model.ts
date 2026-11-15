import mongoose, { Schema } from "mongoose";
import { textField } from "../../../shared/database/fields.js";

export const ALERT_KINDS = [
  "MILESTONE_OVERDUE",
  "PROJECT_OVERDUE",
  "HIGH_CONFLICT",
  "INSPECTION_OVERDUE",
  "CRITICAL_RISK",
  "ISSUE_UNROUTED",
  "ISSUE_OVERDUE",
] as const;

export const ALERT_STATUSES = ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"] as const;

const systemAlertSchema = new Schema({
  kind: { type: String, enum: ALERT_KINDS, required: true },
  severity: { type: String, enum: ["WARNING", "CRITICAL"], required: true, default: "WARNING" },
  title: textField(200, true),
  message: textField(1000, true),
  resourceType: textField(60, true),
  resourceId: { type: Schema.Types.ObjectId, required: true },
  agencyId: { type: Schema.Types.ObjectId, ref: "Agency", default: null },
  actionUrl: textField(300),
  dedupeKey: { ...textField(160, true), unique: true },
  status: { type: String, enum: ALERT_STATUSES, required: true, default: "ACTIVE" },
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  acknowledgedAt: { type: Date, default: null },
  lastEvaluatedAt: { type: Date, required: true, default: () => new Date() },
}, { timestamps: true, strict: "throw", collection: "system_alerts" });

systemAlertSchema.index({ status: 1, agencyId: 1, severity: 1, updatedAt: -1 });

export type SystemAlertDocument = mongoose.InferSchemaType<typeof systemAlertSchema> & { _id: mongoose.Types.ObjectId };
export const SystemAlert =
  (mongoose.models.SystemAlert as mongoose.Model<SystemAlertDocument> | undefined) ??
  mongoose.model<SystemAlertDocument>("SystemAlert", systemAlertSchema);
