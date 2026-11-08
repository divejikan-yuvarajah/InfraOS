import mongoose, { Schema } from "mongoose";
import { DOCUMENT_LIMITS } from "@infraos/shared-types";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";

export const VERSION_STATUSES = ["CURRENT", "SUPERSEDED", "REMOVED"] as const;

/** Immutable version history. Rows are inserted once; only `status` (and the removal stamp) ever change. `storageRef` is opaque, select:false and never serialised. */
const versionSchema = new Schema({
  documentId: reference("Document"),
  versionNo: { type: Number, required: true, min: 1, max: DOCUMENT_LIMITS.maxVersions, validate: Number.isInteger },
  storageRef: { ...textField(300), select: false },
  fileName: textField(255, true),
  mimeType: { ...textField(100, true), match: /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i },
  sizeBytes: { ...nonNegativeInteger(), required: true },
  contentHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  uploadedBy: reference("User"),
  changeNote: textField(500),
  restoredFromVersionNo: { type: Number, min: 1 },
  /** PDF containing /JavaScript or /Launch tokens: download-only, never previewed inline. */
  activeContent: { type: Boolean, default: false },
  status: { type: String, enum: VERSION_STATUSES, required: true, default: "CURRENT" },
  removedAt: Date,
  removedBy: reference("User", false),
  removeReason: textField(500),
}, {
  timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "documentVersions",
  toJSON: { transform(_d, ret: Record<string, unknown>) { delete ret.storageRef; return ret; } },
});
versionSchema.index({ documentId: 1, versionNo: 1 }, { unique: true });
versionSchema.pre("save", function () { if (!this.isNew) throw new Error("documentVersions rows are immutable"); });

export type DocumentVersionDocument = mongoose.InferSchemaType<typeof versionSchema> & { _id: mongoose.Types.ObjectId };
export const DocumentVersion = (mongoose.models.DocumentVersion as mongoose.Model<DocumentVersionDocument> | undefined) ?? mongoose.model<DocumentVersionDocument>("DocumentVersion", versionSchema);
