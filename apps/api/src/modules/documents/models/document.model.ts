import mongoose, { Schema } from "mongoose";
import { AI_ERROR_CODES, AI_WARNING_CODES, DOCUMENT_CATEGORY_KEYS, DOCUMENT_CONFIDENTIALITIES, DOCUMENT_LANGUAGES, DOCUMENT_LIMITS, DOCUMENT_ORIGINS, DOCUMENT_STATUSES } from "@infraos/shared-types";
import { arrayLimit, nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";
import { DOCUMENT_PROCESSING_STATUSES, DOCUMENT_TYPES, DOCUMENT_VISIBILITIES } from "../document.constants.js";

function unsignedStorageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** Result of the last successful AI index (Batch 09). `extractedTextStatus === COMPLETED` is only ever set together with this. */
const aiIndexSchema = new Schema({
  indexedVersionNo: { type: Number, min: 1, validate: Number.isInteger },
  chunkCount: nonNegativeInteger(),
  pageCount: nonNegativeInteger(),
  embeddingModel: textField(120),
  embeddingDimension: nonNegativeInteger(),
  pipelineVersion: textField(20),
  indexedAt: Date,
  lastJobId: reference("DocumentProcessingJob", false),
  errorCode: { type: String, enum: AI_ERROR_CODES },
  warnings: { type: [{ type: String, enum: AI_WARNING_CODES }], default: undefined },
  truncated: Boolean,
}, { _id: false, strict: "throw" });

/**
 * One collection serves two kinds of rows: DocTrace documents (origin DOCTRACE) and Batch 06/07 inspection or maintenance evidence photos
 * (origin INSPECTION_EVIDENCE, managed by their own modules). Every Batch 08 field is optional so legacy rows stay valid until the backfill runs.
 * File bytes never live here: DocTrace bytes are referenced from `documentVersions.storageRef` (select:false). `storageUrl`/`storageKey` are evidence-era fields and never serialised.
 */
const documentSchema = new Schema({
  projectId: reference("Project", false),
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

  // ---- Batch 08 (DocTrace) ----
  docNo: { ...textField(20), match: /^DOC-\d{4}-\d{6}$/ },
  title: textField(200),
  description: textField(2000),
  category: { type: String, enum: DOCUMENT_CATEGORY_KEYS },
  agencyId: reference("Agency", false),
  ownerId: reference("User", false),
  uploadedByAgencyId: reference("Agency", false),
  contractorId: reference("Contractor", false),
  inspectionId: reference("Inspection", false),
  paymentId: reference("ProjectPayment", false),
  expenseId: reference("ProjectExpense", false),
  assetId: reference("Asset", false),
  milestoneId: reference("Milestone", false),
  status: { type: String, enum: DOCUMENT_STATUSES },
  archivedAt: Date,
  archivedBy: reference("User", false),
  archiveReason: textField(500),
  supersededById: reference("Document", false),
  currentVersionNo: { type: Number, min: 1, max: DOCUMENT_LIMITS.maxVersions, validate: Number.isInteger },
  currentVersionId: reference("DocumentVersion", false),
  contentHash: { type: String, match: /^[a-f0-9]{64}$/ },
  pageCount: { ...nonNegativeInteger() },
  language: { type: String, enum: DOCUMENT_LANGUAGES },
  confidentiality: { type: String, enum: DOCUMENT_CONFIDENTIALITIES },
  aiProcessingAllowed: Boolean,
  aiEligibleType: Boolean,
  aiIndex: aiIndexSchema,
  origin: { type: String, enum: DOCUMENT_ORIGINS },
  tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: undefined, validate: arrayLimit(DOCUMENT_LIMITS.maxTags) },
  documentDate: Date,
  reference: textField(100),
  expiresAt: Date,
  version: { type: Number, min: 0, default: 0 },
  // Tombstone of a permanently deleted document: content fields are cleared, identity and the reason remain so audit links do not dangle.
  deletedAt: Date,
  deletedBy: reference("User", false),
  deleteReason: textField(500),
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

documentSchema.pre("validate", function () {
  if (!this.projectId && !this.agencyId) this.invalidate("agencyId", "a document needs an agency or a project");
});

documentSchema.index({ projectId: 1, documentType: 1 });
documentSchema.index({ projectId: 1, createdAt: -1 });
documentSchema.index({ agencyId: 1, status: 1, category: 1, createdAt: -1 });
documentSchema.index({ projectId: 1, status: 1, createdAt: -1 });
documentSchema.index({ docNo: 1 }, { unique: true, partialFilterExpression: { docNo: { $type: "string" } } });
documentSchema.index({ contractorId: 1 }, { partialFilterExpression: { contractorId: { $exists: true } } });
documentSchema.index({ inspectionId: 1 }, { partialFilterExpression: { inspectionId: { $exists: true } } });
documentSchema.index({ assetId: 1 }, { partialFilterExpression: { assetId: { $exists: true } } });
documentSchema.index({ contentHash: 1, agencyId: 1 }, { partialFilterExpression: { contentHash: { $exists: true } } });
documentSchema.index({ tags: 1 });
// `language` is a user-facing metadata field, so MongoDB's per-document language override is pointed at an unused field and stemming is off (en/si/ta mixed content).
documentSchema.index(
  { title: "text", description: "text", fileName: "text", reference: "text", tags: "text" },
  { name: "document_text", weights: { title: 10, reference: 6, tags: 5, fileName: 4, description: 2 }, default_language: "none", language_override: "_textLanguage" },
);

export type DocumentDocument = mongoose.InferSchemaType<typeof documentSchema> & { _id: mongoose.Types.ObjectId };
export const Document = (mongoose.models.Document as mongoose.Model<DocumentDocument> | undefined) ?? mongoose.model<DocumentDocument>("Document", documentSchema);
