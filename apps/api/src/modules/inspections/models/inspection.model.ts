import mongoose, { Schema } from "mongoose";
import { arrayLimit, percentage, reference, textField } from "../../../shared/database/fields.js";
import { INSPECTION_STATUSES } from "../inspection.constants.js";

const inspectionSchema = new Schema({
  projectId: reference("Project"),
  inspectorId: reference("User"),
  inspectionDate: { type: Date, required: true },
  // Unset until assessed; zero is a measured result, not a missing-data default.
  physicalProgress: percentage(),
  status: { type: String, enum: INSPECTION_STATUSES, required: true, default: "SCHEDULED" },
  notes: textField(5000),
  evidence: { type: [reference("Document")], default: [], validate: arrayLimit(50) },
}, { timestamps: true, strict: "throw", collection: "inspections" });

inspectionSchema.index({ projectId: 1, inspectionDate: -1 });
inspectionSchema.index({ inspectorId: 1, status: 1, inspectionDate: -1 });

export type InspectionDocument = mongoose.InferSchemaType<typeof inspectionSchema> & { _id: mongoose.Types.ObjectId };
export const Inspection = (mongoose.models.Inspection as mongoose.Model<InspectionDocument> | undefined) ?? mongoose.model<InspectionDocument>("Inspection", inspectionSchema);
