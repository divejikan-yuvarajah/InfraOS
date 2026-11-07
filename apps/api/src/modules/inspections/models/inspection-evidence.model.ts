import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";
import { EVIDENCE_STATUSES } from "../inspection.constants.js";

const sha = { type: String, required: true, match: /^[a-f0-9]{64}$/ };
const key = { ...textField(60), match: /^[a-z0-9_]+$/ };

/** File identity stays in `Document`; this row links a stored photo to an inspection, a checklist item or a defect. */
const evidenceSchema = new Schema({
  inspectionId: reference("Inspection"), projectId: reference("Project"), agencyId: reference("Agency"),
  documentId: reference("Document"), thumbDocumentId: reference("Document", false),
  caption: textField(300), checklistItemKey: key, defectKey: key,
  capturedAt: { type: Date, required: true }, uploadedAt: { type: Date, required: true, default: Date.now }, uploadedBy: reference("User"),
  location: { type: new Schema({
    point: { type: new Schema({ type: { type: String, enum: ["Point"], required: true }, coordinates: { type: [Number], required: true } }, { _id: false, strict: "throw" }), required: true },
    accuracyM: { type: Number, min: 0, max: 5000, required: true }, source: { type: String, enum: ["DEVICE"], required: true },
  }, { _id: false, strict: "throw" }) },
  sha256: sha, thumbSha256: { type: String, match: /^[a-f0-9]{64}$/ },
  mimeType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
  width: { ...nonNegativeInteger(), max: 4096 }, height: { ...nonNegativeInteger(), max: 4096 }, sizeBytes: { ...nonNegativeInteger(), required: true },
  thumbSizeBytes: nonNegativeInteger(),
  status: { type: String, enum: EVIDENCE_STATUSES, required: true, default: "PENDING_UPLOAD" },
  removedBy: reference("User", false), removedAt: Date, removalReason: textField(300),
  sitePresence: { type: new Schema({ distanceM: { type: Number, required: true }, status: { type: String, enum: ["ON_SITE", "NEAR_SITE", "AWAY"], required: true }, basis: { type: String, enum: ["project_geometry", "inspection_site_point"], required: true } }, { _id: false, strict: "throw" }) },
}, { timestamps: false, strict: "throw", collection: "inspectionEvidence" });

evidenceSchema.index({ inspectionId: 1, status: 1 });
evidenceSchema.index({ projectId: 1, uploadedAt: -1 });
evidenceSchema.index({ documentId: 1 });
evidenceSchema.index({ inspectionId: 1, sha256: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["PENDING_UPLOAD", "ACTIVE"] } } });

export type InspectionEvidenceDocument = mongoose.InferSchemaType<typeof evidenceSchema> & { _id: mongoose.Types.ObjectId };
export const InspectionEvidence = (mongoose.models.InspectionEvidence as mongoose.Model<InspectionEvidenceDocument> | undefined) ?? mongoose.model<InspectionEvidenceDocument>("InspectionEvidence", evidenceSchema);
