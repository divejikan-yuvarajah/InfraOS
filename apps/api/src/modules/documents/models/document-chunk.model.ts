import mongoose, { Schema } from "mongoose";
import { AI_CHUNK_STATUSES } from "@infraos/shared-types";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";

/**
 * One searchable chunk of one document version. `content` is select:false and only the explicit chunk-preview route and the
 * diagnostic/RAG hydration step ever read it. STAGED while a job indexes, ACTIVE once vectors exist, STALE when superseded.
 * Page numbers are absent for DOCX/TXT/CSV (no real pages) and are never invented.
 */
const documentChunkSchema = new Schema({
  documentId: reference("Document"),
  projectId: reference("Project", false),
  agencyId: reference("Agency"),
  versionNo: { type: Number, required: true, min: 1, validate: Number.isInteger },
  chunkIndex: { ...nonNegativeInteger(), required: true },
  chunkId: { type: String, required: true, trim: true, maxlength: 120, match: /^[a-f0-9]{24}:\d+:\d+$/ },
  content: { ...textField(20_000, true), select: false },
  pageStart: { ...nonNegativeInteger() },
  pageEnd: { ...nonNegativeInteger() },
  section: textField(160),
  charCount: { ...nonNegativeInteger(), required: true },
  tokenEstimate: { ...nonNegativeInteger(), required: true },
  contentHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  status: { type: String, enum: AI_CHUNK_STATUSES, required: true, default: "STAGED" },
  embeddingModel: textField(120),
  embeddingDimension: { ...nonNegativeInteger() },
  // Opaque Qdrant point id (UUID), not a vector, endpoint, token, or provider credential.
  embeddingReference: { ...textField(200), match: /^[A-Za-z0-9_.:-]+$/ },
  indexedAt: Date,
}, { timestamps: true, strict: "throw", collection: "documentChunks" });

documentChunkSchema.index({ documentId: 1, versionNo: 1, chunkIndex: 1 }, { unique: true });
documentChunkSchema.index({ agencyId: 1, documentId: 1, status: 1 });
documentChunkSchema.index({ documentId: 1, status: 1 });
documentChunkSchema.index({ chunkId: 1 }, { unique: true });

export type DocumentChunkDocument = mongoose.InferSchemaType<typeof documentChunkSchema> & { _id: mongoose.Types.ObjectId };
export const DocumentChunk = (mongoose.models.DocumentChunk as mongoose.Model<DocumentChunkDocument> | undefined) ?? mongoose.model<DocumentChunkDocument>("DocumentChunk", documentChunkSchema);
