import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";

const documentChunkSchema = new Schema({
  documentId: reference("Document"),
  projectId: reference("Project"),
  chunkIndex: { ...nonNegativeInteger(), required: true },
  content: { ...textField(20_000, true), select: false },
  // Opaque identifier, not a vector, endpoint, token, or provider credential.
  embeddingReference: { ...textField(200), match: /^[A-Za-z0-9_.:-]+$/ },
}, { timestamps: true, strict: "throw", collection: "documentChunks" });

documentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

export type DocumentChunkDocument = mongoose.InferSchemaType<typeof documentChunkSchema> & { _id: mongoose.Types.ObjectId };
export const DocumentChunk = (mongoose.models.DocumentChunk as mongoose.Model<DocumentChunkDocument> | undefined) ?? mongoose.model<DocumentChunkDocument>("DocumentChunk", documentChunkSchema);
