import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";

/** File identity stays in `Document`; bytes live in the shared evidence storage (GridFS). Same shape rules as inspection evidence. */
const schemaDef = new Schema({
  maintenanceId: reference("MaintenanceRecord"), assetId: reference("Asset"), agencyId: reference("Agency"),
  documentId: reference("Document"), thumbDocumentId: reference("Document", false),
  caption: textField(300), capturedAt: { type: Date, required: true }, uploadedAt: { type: Date, required: true, default: Date.now }, uploadedBy: reference("User"),
  sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ }, thumbSha256: { type: String, match: /^[a-f0-9]{64}$/ },
  mimeType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
  width: { ...nonNegativeInteger(), max: 4096 }, height: { ...nonNegativeInteger(), max: 4096 }, sizeBytes: { ...nonNegativeInteger(), required: true }, thumbSizeBytes: nonNegativeInteger(),
  status: { type: String, enum: ["PENDING_UPLOAD", "ACTIVE", "REMOVED"], required: true, default: "PENDING_UPLOAD" },
  removedBy: reference("User", false), removedAt: Date, removalReason: textField(300),
}, { timestamps: false, strict: "throw", collection: "maintenanceEvidence" });

schemaDef.index({ maintenanceId: 1, status: 1 });
schemaDef.index({ assetId: 1, uploadedAt: -1 });
schemaDef.index({ maintenanceId: 1, sha256: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["PENDING_UPLOAD", "ACTIVE"] } } });

export type MaintenanceEvidenceDocument = mongoose.InferSchemaType<typeof schemaDef> & { _id: mongoose.Types.ObjectId };
export const MaintenanceEvidence = (mongoose.models.MaintenanceEvidence as mongoose.Model<MaintenanceEvidenceDocument> | undefined) ?? mongoose.model<MaintenanceEvidenceDocument>("MaintenanceEvidence", schemaDef);
