import mongoose, { Schema } from "mongoose";
import { locationSchema, percentage, reference, textField } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { ASSET_CONDITIONS, ASSET_TYPES } from "../asset.constants.js";

const assetSchema = new Schema({
  sourceProjectId: reference("Project"),
  assetType: { type: String, enum: ASSET_TYPES, required: true },
  name: textField(200, true),
  location: { type: locationSchema },
  // InfraMap geometry and agency ownership after handover.
  geometry: geometryField(),
  agencyId: reference("Agency"),
  condition: { type: String, enum: ASSET_CONDITIONS, required: true, default: "UNKNOWN" },
  healthScore: percentage(),
  commissionedAt: { type: Date, required: true },
  lastInspectionAt: { type: Date },
  nextMaintenanceAt: { type: Date },
}, { timestamps: true, strict: "throw", collection: "assets" });

export type AssetDocument = mongoose.InferSchemaType<typeof assetSchema> & { _id: mongoose.Types.ObjectId };
export const Asset = (mongoose.models.Asset as mongoose.Model<AssetDocument> | undefined) ?? mongoose.model<AssetDocument>("Asset", assetSchema);
