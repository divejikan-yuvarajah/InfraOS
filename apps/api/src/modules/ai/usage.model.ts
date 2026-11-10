import mongoose, { Schema } from "mongoose";
import { AI_USAGE_KINDS, AI_USAGE_PURPOSES, AI_USAGE_STATUSES } from "@infraos/shared-types";
import { nonNegativeInteger, reference, textField } from "../../shared/database/fields.js";

/** Token usage ledger (embeddings now; chat/vision later). estimatedCostMinor is set only when a verified price constant is configured. */
const usageSchema = new Schema({
  kind: { type: String, enum: AI_USAGE_KINDS, required: true },
  purpose: { type: String, enum: AI_USAGE_PURPOSES },
  agencyId: reference("Agency"),
  userId: reference("User", false),
  documentId: reference("Document", false),
  jobId: reference("DocumentProcessingJob", false),
  provider: textField(40, true),
  model: textField(120, true),
  inputTokens: { ...nonNegativeInteger(), default: 0 },
  outputTokens: { ...nonNegativeInteger(), default: 0 },
  estimatedCostMinor: { ...nonNegativeInteger() },
  requestCount: { ...nonNegativeInteger(), default: 1 },
  feature: { type: String, trim: true },
  providerPolicy: { type: String, trim: true },
  flags: [{ type: String, trim: true }],
  costUnits: { ...nonNegativeInteger() },
  latencyMs: { ...nonNegativeInteger() },
  status: { type: String, enum: AI_USAGE_STATUSES, required: true, default: "OK" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "aiUsageRecords" });

usageSchema.index({ agencyId: 1, createdAt: -1 });
usageSchema.index({ kind: 1, createdAt: -1 });

export type AiUsageDocument = mongoose.InferSchemaType<typeof usageSchema> & { _id: mongoose.Types.ObjectId };
export const AiUsageRecord = (mongoose.models.AiUsageRecord as mongoose.Model<AiUsageDocument> | undefined) ?? mongoose.model<AiUsageDocument>("AiUsageRecord", usageSchema);
