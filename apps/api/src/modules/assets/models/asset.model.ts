import mongoose, { Schema } from "mongoose";
import { locationSchema, percentage, reference, textField } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { ASSET_CONDITIONS, ASSET_OPERATIONAL_STATUSES, ASSET_ORIGINS, ASSET_SENSITIVITIES, ASSET_TYPES, MONITORING_MAX_DAYS, MONITORING_MIN_DAYS } from "../asset.constants.js";

const assetSchema = new Schema({
  assetNo: { type: String, trim: true, maxlength: 24, match: /^AST-\d{4}-\d{6}$/ },
  sourceProjectId: reference("Project"),
  origin: { type: String, enum: ASSET_ORIGINS },
  conversionId: reference("AssetConversion", false),
  assetType: { type: String, enum: ASSET_TYPES, required: true },
  name: textField(200, true),
  description: textField(2000),
  location: { type: locationSchema },
  // InfraMap geometry and agency ownership after handover.
  geometry: geometryField(),
  /** Owning / responsible agency after handover. */
  agencyId: reference("Agency"),
  /** The project's agency at conversion time (who built it). */
  constructionAgencyId: reference("Agency", false),
  operationalStatus: { type: String, enum: ASSET_OPERATIONAL_STATUSES, default: "IN_SERVICE" },
  handoverAt: { type: Date },
  // Entered at handover. Never computed from an assumed statutory period.
  defectsLiabilityEndsOn: { type: Date },
  designLifeYears: { type: Number, min: 1, max: 150, validate: Number.isInteger },
  monitoringIntervalDays: { type: Number, min: MONITORING_MIN_DAYS, max: MONITORING_MAX_DAYS, validate: Number.isInteger },
  // Server-maintained caches (written only by the asset services, in the same transaction as their cause).
  condition: { type: String, enum: ASSET_CONDITIONS, required: true, default: "UNKNOWN" },
  healthScore: percentage(),
  commissionedAt: { type: Date, required: true },
  lastInspectionAt: { type: Date },
  nextMaintenanceAt: { type: Date },
  // Optional, no backfill. When absent, utility-typed assets are treated as RESTRICTED (see inframap.access.ts).
  sensitivity: { type: String, enum: ASSET_SENSITIVITIES },
  version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, strict: "throw", collection: "assets" });

assetSchema.index({ agencyId: 1, condition: 1 });
assetSchema.index({ nextMaintenanceAt: 1 });
// InfraMap facets and filters group and match on type then condition.
assetSchema.index({ assetType: 1, condition: 1 });
assetSchema.index({ geometry: "2dsphere" });
assetSchema.index({ agencyId: 1, operationalStatus: 1 });
assetSchema.index({ constructionAgencyId: 1 });
assetSchema.index({ sourceProjectId: 1 });
assetSchema.index({ assetNo: 1 }, { unique: true, sparse: true });

export type AssetDocument = mongoose.InferSchemaType<typeof assetSchema> & { _id: mongoose.Types.ObjectId };
export const Asset = (mongoose.models.Asset as mongoose.Model<AssetDocument> | undefined) ?? mongoose.model<AssetDocument>("Asset", assetSchema);
