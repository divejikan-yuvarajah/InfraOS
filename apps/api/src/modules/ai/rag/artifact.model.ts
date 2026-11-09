import mongoose, { Schema } from "mongoose";
import { AI_ARTIFACT_ACTIVE_STATUSES, AI_ARTIFACT_KINDS, AI_ARTIFACT_PHASES, AI_ARTIFACT_STATUSES, AI_ARTIFACT_WARNINGS, AI_LANGUAGES, EXTRACTION_DECISIONS } from "@infraos/shared-types";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";

/** Summaries and extractions for one document version. Shared among users who may read+ask the document (access is re-checked per request). */
const citationSchema = new Schema({
  n: { type: Number, required: true, min: 1 }, chunkId: textField(120, true), pageStart: nonNegativeInteger(), pageEnd: nonNegativeInteger(), section: textField(160), quote: textField(240), quoteVerified: { type: Boolean, default: false },
}, { _id: false, strict: "throw" });

const decisionSchema = new Schema({
  decision: { type: String, enum: EXTRACTION_DECISIONS, required: true, default: "PENDING" }, editedValue: textField(1500), decidedBy: reference("User", false), decidedAt: Date,
}, { _id: false, strict: "throw" });

const usageSchema = new Schema({ inputTokens: { ...nonNegativeInteger(), default: 0 }, outputTokens: { ...nonNegativeInteger(), default: 0 }, estimatedCostMinor: nonNegativeInteger() }, { _id: false, strict: "throw" });

const artifactSchema = new Schema({
  kind: { type: String, enum: AI_ARTIFACT_KINDS, required: true }, documentId: reference("Document"), versionNo: { type: Number, required: true, min: 1 }, agencyId: reference("Agency"),
  template: textField(40, true), language: { type: String, enum: AI_LANGUAGES, required: true }, status: { type: String, enum: AI_ARTIFACT_STATUSES, required: true, default: "QUEUED" },
  result: { type: Schema.Types.Mixed }, citations: { type: [citationSchema], default: [] },
  evidence: { type: new Schema({ level: String, unverifiedFigures: [String], droppedClaims: nonNegativeInteger(), quotesVerified: nonNegativeInteger(), quotesTotal: nonNegativeInteger() }, { _id: false, strict: "throw" }) },
  coverage: { type: new Schema({ pagesFrom: nonNegativeInteger(), pagesTo: nonNegativeInteger(), chunksUsed: nonNegativeInteger(), chunksTotal: nonNegativeInteger(), truncated: Boolean }, { _id: false, strict: "throw" }) },
  progress: { type: new Schema({ phase: { type: String, enum: AI_ARTIFACT_PHASES }, done: { ...nonNegativeInteger(), default: 0 }, total: { ...nonNegativeInteger(), default: 0 }, mapResults: { type: [Schema.Types.Mixed], default: [] } }, { _id: false, strict: "throw" }) },
  warnings: { type: [{ type: String, enum: AI_ARTIFACT_WARNINGS }], default: [] },
  model: textField(120), promptVersion: textField(40), usage: { type: usageSchema },
  requestedBy: reference("User"), errorCode: textField(40),
  review: { type: new Schema({ fields: { type: Map, of: decisionSchema, default: undefined }, status: { type: String, enum: ["IN_REVIEW", "REVIEWED"], default: "IN_REVIEW" } }, { _id: false, strict: "throw" }) },
  leaseUntil: Date, lockedBy: textField(80), attempt: { ...nonNegativeInteger(), default: 0 }, nextAttemptAt: Date, version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, strict: "throw", collection: "documentAiArtifacts" });

artifactSchema.index({ documentId: 1, versionNo: 1, kind: 1, template: 1, language: 1 }, { unique: true, partialFilterExpression: { status: { $in: [...AI_ARTIFACT_ACTIVE_STATUSES] } } });
artifactSchema.index({ agencyId: 1, createdAt: -1 });
artifactSchema.index({ status: 1, leaseUntil: 1 });

export type AiArtifactDocument = mongoose.InferSchemaType<typeof artifactSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const AiArtifact = (mongoose.models.AiArtifact as mongoose.Model<AiArtifactDocument> | undefined) ?? mongoose.model<AiArtifactDocument>("AiArtifact", artifactSchema);
