import mongoose, { Schema } from "mongoose";
import { AI_ACTIVE_JOB_STATUSES, AI_ERROR_CODES, AI_JOB_STAGES, AI_JOB_STATUSES, AI_JOB_TRIGGERS, AI_STAGE_STATUSES, AI_WARNING_CODES } from "@infraos/shared-types";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";

/** Durable processing state. FastAPI is stateless, so everything resumable lives here. No document text, file names or free-form service messages. */
const stageSchema = new Schema({
  key: { type: String, enum: AI_JOB_STAGES, required: true },
  status: { type: String, enum: AI_STAGE_STATUSES, required: true, default: "PENDING" },
  startedAt: Date,
  finishedAt: Date,
  errorCode: { type: String, enum: AI_ERROR_CODES },
}, { _id: false, strict: "throw" });

const statsSchema = new Schema({
  pages: { ...nonNegativeInteger(), default: 0 },
  chars: { ...nonNegativeInteger(), default: 0 },
  chunks: { ...nonNegativeInteger(), default: 0 },
  duplicatesDropped: { ...nonNegativeInteger(), default: 0 },
  embedded: { ...nonNegativeInteger(), default: 0 },
  tokens: { ...nonNegativeInteger(), default: 0 },
  truncated: { type: Boolean, default: false },
}, { _id: false, strict: "throw" });

const jobSchema = new Schema({
  documentId: reference("Document"),
  versionNo: { type: Number, required: true, min: 1, validate: Number.isInteger },
  agencyId: reference("Agency"),
  projectId: reference("Project", false),
  trigger: { type: String, enum: AI_JOB_TRIGGERS, required: true },
  status: { type: String, enum: AI_JOB_STATUSES, required: true, default: "QUEUED" },
  stage: { type: String, enum: AI_JOB_STAGES, required: true, default: "PENDING" },
  stages: { type: [stageSchema], default: [] },
  attempt: { ...nonNegativeInteger(), default: 0 },
  maxAttempts: { type: Number, min: 1, max: 10, default: 3 },
  nextAttemptAt: { type: Date, required: true, default: () => new Date() },
  lockedBy: textField(80),
  leaseUntil: Date,
  errorCode: { type: String, enum: AI_ERROR_CODES },
  // Translatable key only (for example "ai.error.SCANNED_NO_TEXT"); never a free-text message from the service.
  errorMessageKey: textField(120),
  warnings: { type: [{ type: String, enum: AI_WARNING_CODES }], default: [] },
  stats: { type: statsSchema, default: () => ({}) },
  pipelineVersion: textField(20, true),
  embeddingModel: textField(120),
  requestedBy: reference("User", false),
  startedAt: Date,
  finishedAt: Date,
  version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, strict: "throw", collection: "documentProcessingJobs" });

jobSchema.index(
  { documentId: 1, versionNo: 1 },
  { unique: true, partialFilterExpression: { status: { $in: [...AI_ACTIVE_JOB_STATUSES] } } },
);
jobSchema.index({ status: 1, nextAttemptAt: 1 });
jobSchema.index({ agencyId: 1, createdAt: -1 });
jobSchema.index({ documentId: 1, createdAt: -1 });

export type ProcessingJobDocument = mongoose.InferSchemaType<typeof jobSchema> & { _id: mongoose.Types.ObjectId };
export const ProcessingJob = (mongoose.models.DocumentProcessingJob as mongoose.Model<ProcessingJobDocument> | undefined) ?? mongoose.model<ProcessingJobDocument>("DocumentProcessingJob", jobSchema);
