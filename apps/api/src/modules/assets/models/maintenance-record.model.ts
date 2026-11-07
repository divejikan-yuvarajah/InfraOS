import mongoose, { Schema } from "mongoose";
import { arrayLimit, dateOrder, moneySchema, reference, textField } from "../../../shared/database/fields.js";
import { MAINTENANCE_ORIGINS, MAINTENANCE_OUTCOMES, MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES, MAINTENANCE_TYPES } from "../asset.constants.js";

const task = new Schema({
  key: { type: String, required: true, trim: true, maxlength: 40, match: /^[a-z0-9_]+$/ }, title: textField(160, true),
  done: { type: Boolean, required: true, default: false }, skippedNote: textField(300),
}, { _id: false, strict: "throw" });

const maintenanceRecordSchema = new Schema({
  maintenanceNo: { type: String, trim: true, maxlength: 24, match: /^MNT-\d{4}-\d{6}$/ },
  assetId: reference("Asset"),
  agencyId: reference("Agency", false),
  title: textField(160),
  description: textField(3000),
  maintenanceType: { type: String, enum: MAINTENANCE_TYPES, required: true },
  priority: { type: String, enum: MAINTENANCE_PRIORITIES },
  origin: { type: String, enum: MAINTENANCE_ORIGINS },
  scheduledDate: { type: Date, required: true },
  completedDate: { type: Date },
  requestedBy: reference("User", false), requestedAt: { type: Date },
  decidedBy: reference("User", false), decidedAt: { type: Date }, decisionNote: textField(500),
  responsibleAgencyId: reference("Agency", false),
  assignedTeam: textField(120),
  contractorId: reference("Contractor", false),
  tasks: { type: [task], default: [], validate: arrayLimit(20) },
  estimatedCost: { type: moneySchema },
  // Actual cost. Unset until recorded; do not imply unknown work is free.
  cost: { type: moneySchema },
  // OVERDUE is derived, never written.
  status: { type: String, enum: MAINTENANCE_STATUSES, required: true, default: "PLANNED" },
  startedAt: { type: Date },
  completionNotes: textField(3000),
  outcome: { type: String, enum: MAINTENANCE_OUTCOMES },
  completedBy: reference("User", false),
  cancelReason: textField(500),
  recurrenceDays: { type: Number, min: 30, max: 1825, validate: Number.isInteger },
  previousRecordId: reference("MaintenanceRecord", false),
  linkedIssueKeys: { type: [{ type: String, maxlength: 60 }], default: [], validate: arrayLimit(20) },
  emergencyAcknowledged: { type: Boolean },
  version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, strict: "throw", collection: "maintenanceRecords" });

dateOrder(maintenanceRecordSchema, "scheduledDate", "completedDate");

maintenanceRecordSchema.index({ assetId: 1, scheduledDate: -1 });
maintenanceRecordSchema.index({ status: 1, scheduledDate: 1 });
maintenanceRecordSchema.index({ maintenanceNo: 1 }, { unique: true, sparse: true });
maintenanceRecordSchema.index({ agencyId: 1, status: 1, scheduledDate: 1 });
// One recurrence per completed record: makes the "create the next preventive job" step idempotent.
maintenanceRecordSchema.index({ previousRecordId: 1 }, { unique: true, partialFilterExpression: { previousRecordId: { $type: "objectId" } } });

export type MaintenanceRecordDocument = mongoose.InferSchemaType<typeof maintenanceRecordSchema> & { _id: mongoose.Types.ObjectId };
export const MaintenanceRecord = (mongoose.models.MaintenanceRecord as mongoose.Model<MaintenanceRecordDocument> | undefined) ?? mongoose.model<MaintenanceRecordDocument>("MaintenanceRecord", maintenanceRecordSchema);
