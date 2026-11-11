import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger } from "../../../shared/database/fields.js";

const usageDailySchema = new Schema({
  day: { type: String, required: true }, // YYYY-MM-DD Asia/Colombo
  scope: { type: String, required: true }, // "PLATFORM" | agencyId string
  feature: { type: String, required: true }, // qa, summary, extraction, riskNarrative, vision, copilot, embedding
  tier: { type: String, required: true }, // LOW, STRONG, VISION, EMBED
  requests: { ...nonNegativeInteger(), default: 0 },
  inputTokens: { ...nonNegativeInteger(), default: 0 },
  outputTokens: { ...nonNegativeInteger(), default: 0 },
  images: { ...nonNegativeInteger(), default: 0 },
  costMinor: { ...nonNegativeInteger(), default: 0 },
  errors: { ...nonNegativeInteger(), default: 0 },
  fallbacks: { ...nonNegativeInteger(), default: 0 },
}, {
  timestamps: { createdAt: true, updatedAt: true },
  strict: "throw",
  suppressReservedKeysWarning: true,
  collection: "aiUsageDaily",
});

usageDailySchema.index({ day: 1, scope: 1, feature: 1, tier: 1 }, { unique: true });
usageDailySchema.index({ scope: 1, day: -1 });

export type AiUsageDailyDocument = mongoose.InferSchemaType<typeof usageDailySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AiUsageDaily =
  (mongoose.models.AiUsageDaily as mongoose.Model<AiUsageDailyDocument> | undefined) ??
  mongoose.model<AiUsageDailyDocument>("AiUsageDaily", usageDailySchema);
