import mongoose, { Schema } from "mongoose";
import { arrayLimit, locationSchema, reference, textField } from "../../../shared/database/fields.js";
import { ASSET_CONDITIONS, ASSET_TYPES, CONVERSION_STATUSES, MONITORING_MAX_DAYS, MONITORING_MIN_DAYS } from "../asset.constants.js";

const proposed = new Schema({
  key: { type: String, required: true, trim: true, maxlength: 40, match: /^[a-z0-9_]+$/ },
  assetType: { type: String, enum: ASSET_TYPES, required: true },
  name: textField(200, true), description: textField(2000),
  location: { type: locationSchema },
  geometrySource: { type: String, enum: ["PROJECT", "NONE"], required: true, default: "NONE" },
  commissionedAt: { type: Date },
  designLifeYears: { type: Number, min: 1, max: 150, validate: Number.isInteger },
  monitoringIntervalDays: { type: Number, min: MONITORING_MIN_DAYS, max: MONITORING_MAX_DAYS, validate: Number.isInteger },
}, { _id: false, strict: "throw" });

const gate = new Schema({ key: textField(40, true), status: { type: String, enum: ["PASS", "WARN", "BLOCK", "SKIPPED"], required: true }, message: textField(400, true) }, { _id: false, strict: "throw" });
const gateSnapshot = new Schema({ at: { type: String, enum: ["REQUEST", "DECISION"], required: true }, evaluatedAt: { type: Date, required: true }, gates: { type: [gate], default: [] } }, { _id: false, strict: "throw" });

/** A request to turn a completed project into registered assets. The project itself is never edited by this record. */
const conversionSchema = new Schema({
  conversionNo: { type: String, trim: true, maxlength: 24, match: /^CNV-\d{4}-\d{6}$/ },
  projectId: reference("Project"), agencyId: reference("Agency"),
  status: { type: String, enum: CONVERSION_STATUSES, required: true, default: "PENDING_APPROVAL" },
  requestedBy: reference("User"), requestedAt: { type: Date, required: true },
  decidedBy: reference("User", false), decidedAt: { type: Date }, decisionNote: textField(500),
  receivingAgencyId: reference("Agency"),
  handover: { type: new Schema({
    handoverDate: { type: Date, required: true }, handoverNote: textField(2000), defectsLiabilityEndsOn: { type: Date },
    documentIds: { type: [reference("Document")], default: [], validate: arrayLimit(20) },
    conditionAtHandover: { type: String, enum: ASSET_CONDITIONS, default: "UNKNOWN" },
  }, { _id: false, strict: "throw" }), required: true },
  proposedAssets: { type: [proposed], default: [], validate: [(v: unknown[]) => v.length >= 1 && v.length <= 10, "1 to 10 proposed assets"] },
  gateResults: { type: [gateSnapshot], default: [], validate: arrayLimit(4) },
  createdAssetIds: { type: [reference("Asset")], default: [], validate: arrayLimit(10) },
  version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, strict: "throw", collection: "assetConversions" });

conversionSchema.index({ conversionNo: 1 }, { unique: true, sparse: true });
// One active conversion per project; rejected or cancelled ones free the project for a new request.
conversionSchema.index({ projectId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["PENDING_APPROVAL", "APPROVED"] } } });
conversionSchema.index({ agencyId: 1, status: 1, requestedAt: -1 });
conversionSchema.index({ receivingAgencyId: 1, status: 1 });

export type AssetConversionDocument = mongoose.InferSchemaType<typeof conversionSchema> & { _id: mongoose.Types.ObjectId };
export const AssetConversion = (mongoose.models.AssetConversion as mongoose.Model<AssetConversionDocument> | undefined) ?? mongoose.model<AssetConversionDocument>("AssetConversion", conversionSchema);
