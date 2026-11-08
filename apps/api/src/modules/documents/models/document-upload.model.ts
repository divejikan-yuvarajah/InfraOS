import mongoose, { Schema } from "mongoose";
import { reference, textField } from "../../../shared/database/fields.js";

export const UPLOAD_STATUSES = ["PENDING", "STORED", "COMMITTED", "ABORTED", "REJECTED"] as const;

/**
 * Upload ticket for the init -> stream -> commit protocol. Holds the validated metadata and the server-generated storage key
 * (select:false, never returned). Tickets that never commit are swept by `db:cleanup:documents` after 24 hours.
 */
const uploadSchema = new Schema({
  kind: { type: String, enum: ["NEW", "VERSION"], required: true },
  actorId: reference("User"),
  agencyId: reference("Agency"),
  documentId: reference("Document"),
  versionNo: { type: Number, required: true, min: 1 },
  fileName: textField(255, true),
  declaredMime: textField(100, true),
  declaredSize: { type: Number, required: true, min: 1 },
  /** Validated metadata for kind NEW (category, links, tags...). Only ever written by the service after zod + scope checks. */
  meta: { type: Schema.Types.Mixed },
  changeNote: textField(500),
  storageRef: { ...textField(300), select: false },
  sizeBytes: Number,
  contentHash: { type: String, match: /^[a-f0-9]{64}$/ },
  detectedMime: textField(100),
  activeContent: Boolean,
  duplicateOf: reference("Document", false),
  status: { type: String, enum: UPLOAD_STATUSES, required: true, default: "PENDING" },
}, { timestamps: true, strict: "throw", collection: "documentUploads" });
uploadSchema.index({ status: 1, createdAt: 1 });
uploadSchema.index({ actorId: 1, createdAt: -1 });

export type DocumentUploadDocument = mongoose.InferSchemaType<typeof uploadSchema> & { _id: mongoose.Types.ObjectId };
export const DocumentUpload = (mongoose.models.DocumentUpload as mongoose.Model<DocumentUploadDocument> | undefined) ?? mongoose.model<DocumentUploadDocument>("DocumentUpload", uploadSchema);
