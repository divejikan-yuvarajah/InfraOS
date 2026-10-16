import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";
import { DOCUMENT_PROCESSING_STATUSES, DOCUMENT_TYPES, DOCUMENT_VISIBILITIES } from "../document.constants.js";

function unsignedStorageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

const documentSchema = new Schema({
  projectId: reference("Project"),
  documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
  fileName: textField(255, true),
  // Optional until storage integration. Never persist presigned URLs/credentials.
  storageUrl: { ...textField(2048), select: false, validate: unsignedStorageUrl },
  storageKey: { ...textField(512), select: false },
  uploadedBy: reference("User"),
  extractedTextStatus: { type: String, enum: DOCUMENT_PROCESSING_STATUSES, required: true, default: "NOT_STARTED" },
  mimeType: { ...textField(100), match: /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i },
  sizeBytes: nonNegativeInteger(),
  visibility: { type: String, enum: DOCUMENT_VISIBILITIES, required: true, default: "INTERNAL" },
}, {
  timestamps: true, strict: "throw", collection: "documents",
  toJSON: {
    transform(_doc, ret: Record<string, unknown>) {
      delete ret.storageUrl;
      delete ret.storageKey;
      return ret;
    },
  },
});

documentSchema.index({ projectId: 1, documentType: 1 });
documentSchema.index({ projectId: 1, createdAt: -1 });

export type DocumentDocument = mongoose.InferSchemaType<typeof documentSchema> & { _id: mongoose.Types.ObjectId };
export const Document = (mongoose.models.Document as mongoose.Model<DocumentDocument> | undefined) ?? mongoose.model<DocumentDocument>("Document", documentSchema);
