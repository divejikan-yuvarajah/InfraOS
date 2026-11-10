import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, reference } from "../../../shared/database/fields.js";

const featureTogglesSchema = new Schema({
  qaEnabled: { type: Boolean, default: true },
  summaryEnabled: { type: Boolean, default: true },
  extractionEnabled: { type: Boolean, default: true },
  riskNarrativeEnabled: { type: Boolean, default: true },
  visionEnabled: { type: Boolean, default: false }, // OFF by default
  copilotEnabled: { type: Boolean, default: true },
  embeddingEnabled: { type: Boolean, default: true },
}, { _id: false });

const limitsSchema = new Schema({
  userRequestsPer10Min: {
    qa: { ...nonNegativeInteger(), default: 20 },
    summary: { ...nonNegativeInteger(), default: 6 },
    extraction: { ...nonNegativeInteger(), default: 6 },
    riskNarrative: { ...nonNegativeInteger(), default: 6 },
    vision: { ...nonNegativeInteger(), default: 4 },
    copilot: { ...nonNegativeInteger(), default: 15 },
    embedding: { ...nonNegativeInteger(), default: 30 },
  },
  agencyRequestsPerDay: {
    qa: { ...nonNegativeInteger(), default: 2000 },
    summary: { ...nonNegativeInteger(), default: 500 },
    extraction: { ...nonNegativeInteger(), default: 500 },
    riskNarrative: { ...nonNegativeInteger(), default: 500 },
    vision: { ...nonNegativeInteger(), default: 200 },
    copilot: { ...nonNegativeInteger(), default: 1500 },
    embedding: { ...nonNegativeInteger(), default: 3000 },
  },
  concurrencyPerUser: { ...nonNegativeInteger(), default: 1 },
  copilotMaxMessageLength: { ...nonNegativeInteger(), default: 800 },
  visionMaxImages: { ...nonNegativeInteger(), default: 6 },
}, { _id: false });

const budgetsSchema = new Schema({
  dailyTokenBudget: {
    LOW: { ...nonNegativeInteger(), default: 1_000_000 },
    STRONG: { ...nonNegativeInteger(), default: 500_000 },
    VISION: { ...nonNegativeInteger(), default: 500_000 },
    EMBED: { ...nonNegativeInteger(), default: 2_000_000 },
  },
  monthlyTokenBudget: {
    LOW: { ...nonNegativeInteger(), default: 25_000_000 },
    STRONG: { ...nonNegativeInteger(), default: 12_500_000 },
    VISION: { ...nonNegativeInteger(), default: 12_500_000 },
    EMBED: { ...nonNegativeInteger(), default: 50_000_000 },
  },
  dailyVisionImages: { ...nonNegativeInteger(), default: 100 },
}, { _id: false });

const catalogEntrySchema = new Schema({
  modelId: { type: String, trim: true, default: "" },
  verifiedAt: { type: Date },
  source: { type: String, enum: ["admin-entered", "provider-listing"], default: "admin-entered" },
  pricePerMInputMinor: { ...nonNegativeInteger() },
  pricePerMOutputMinor: { ...nonNegativeInteger() },
  pricePerImageMinor: { ...nonNegativeInteger() },
}, { _id: false });

const modelCatalogSchema = new Schema({
  LOW: { type: catalogEntrySchema, default: () => ({}) },
  STRONG: { type: catalogEntrySchema, default: () => ({}) },
  VISION: { type: catalogEntrySchema, default: () => ({}) },
  EMBED: { type: catalogEntrySchema, default: () => ({}) },
}, { _id: false });

const routingSchema = new Schema({
  strongSummaryInputThreshold: { ...nonNegativeInteger(), default: 10_000 },
  autoDowngradeAtBudgetPercent: { ...nonNegativeInteger(), default: 80 },
}, { _id: false });

const aiSettingsSchema = new Schema({
  scope: { type: String, enum: ["PLATFORM", "AGENCY"], required: true },
  agencyId: reference("Agency", false),
  featureToggles: { type: featureTogglesSchema, default: () => ({}) },
  limits: { type: limitsSchema, default: () => ({}) },
  budgets: { type: budgetsSchema, default: () => ({}) },
  modelCatalog: { type: modelCatalogSchema, default: () => ({}) },
  routing: { type: routingSchema, default: () => ({}) },
  updatedBy: reference("User", false),
  version: { type: Number, default: 1 },
}, {
  timestamps: true,
  strict: "throw",
  collection: "aiSettings",
});

aiSettingsSchema.index({ scope: 1, agencyId: 1 }, { unique: true });

export type AiSettingsDocument = mongoose.InferSchemaType<typeof aiSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AiSettings =
  (mongoose.models.AiSettings as mongoose.Model<AiSettingsDocument> | undefined) ??
  mongoose.model<AiSettingsDocument>("AiSettings", aiSettingsSchema);
