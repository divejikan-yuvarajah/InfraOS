import mongoose, { Schema } from "mongoose";
import { dateOrder, moneySchema, reference } from "../../../shared/database/fields.js";
import { MAINTENANCE_STATUSES, MAINTENANCE_TYPES } from "../asset.constants.js";

const maintenanceRecordSchema = new Schema({
  assetId: reference("Asset"),
  maintenanceType: { type: String, enum: MAINTENANCE_TYPES, required: true },
  scheduledDate: { type: Date, required: true },
  completedDate: { type: Date },
  // Unset until estimated/recorded; do not imply unknown work is free.
  cost: { type: moneySchema },
  status: { type: String, enum: MAINTENANCE_STATUSES, required: true, default: "PLANNED" },
}, { timestamps: true, strict: "throw", collection: "maintenanceRecords" });

dateOrder(maintenanceRecordSchema, "scheduledDate", "completedDate");

maintenanceRecordSchema.index({ assetId: 1, scheduledDate: -1 });
maintenanceRecordSchema.index({ status: 1, scheduledDate: 1 });

export type MaintenanceRecordDocument = mongoose.InferSchemaType<typeof maintenanceRecordSchema> & { _id: mongoose.Types.ObjectId };
export const MaintenanceRecord = (mongoose.models.MaintenanceRecord as mongoose.Model<MaintenanceRecordDocument> | undefined) ?? mongoose.model<MaintenanceRecordDocument>("MaintenanceRecord", maintenanceRecordSchema);
