import mongoose, { Schema } from "mongoose";
import {
  AI_EVIDENCE_LEVELS,
  AI_FEEDBACK_REASONS,
  AI_FEEDBACK_RATINGS,
  AI_LANGUAGES,
  AI_QA_STATUSES,
  AI_SCOPE_MODES,
  COPILOT_PAGE_TYPES,
  COPILOT_STEP_KINDS,
  COPILOT_STEP_STATUSES,
  COPILOT_TURN_STATUSES,
} from "@infraos/shared-types";
import { nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";

/**
 * Private Q&A and Copilot interaction history. Only the author ever reads a row (admins see aggregates).
 * Holds question/answer text, verified quotes or copilot facts, never raw chunks.
 * Expires by TTL (AI_INTERACTION_TTL_DAYS, default 90 for QA, 30 for Copilot) via `expiresAt`.
 */
const citationSchema = new Schema({
  n: { type: Number, required: true, min: 1 }, chunkId: textField(120, true), documentId: reference("Document"), versionNo: { type: Number, required: true, min: 1 },
  pageStart: nonNegativeInteger(), pageEnd: nonNegativeInteger(), section: textField(160), quote: textField(240), quoteVerified: { type: Boolean, required: true, default: false }, wasNeighbor: { type: Boolean, default: false },
}, { _id: false, strict: "throw" });

const scopeSchema = new Schema({
  mode: { type: String, enum: AI_SCOPE_MODES, required: true }, documentIds: { type: [Schema.Types.ObjectId], default: undefined }, projectId: reference("Project", false),
}, { _id: false, strict: "throw" });

const stepSchema = new Schema({
  at: { type: Date, required: true, default: Date.now },
  kind: { type: String, enum: COPILOT_STEP_KINDS, required: true },
  tool: textField(80),
  status: { type: String, enum: COPILOT_STEP_STATUSES, required: true },
  labelKey: textField(120, true),
  durationMs: { ...nonNegativeInteger(), default: 0 },
}, { _id: false, strict: "throw" });

const sourceSchema = new Schema({
  n: { type: Number, required: true, min: 1 },
  type: textField(60, true),
  recordId: textField(100),
  label: textField(200, true),
  link: textField(300, true),
  asOf: Date,
  tool: textField(80, true),
}, { _id: false, strict: "throw" });

const pageContextSchema = new Schema({
  type: { type: String, enum: COPILOT_PAGE_TYPES, required: true },
  recordId: textField(100),
  route: textField(300, true),
}, { _id: false, strict: "throw" });

const ALL_INTERACTION_STATUSES = Array.from(new Set([...AI_QA_STATUSES, ...COPILOT_TURN_STATUSES]));

const interactionSchema = new Schema({
  kind: { type: String, enum: ["QA", "COPILOT"], required: true, default: "QA" },
  userId: reference("User"), agencyId: reference("Agency"), threadId: { type: String, required: true, match: /^[a-f0-9-]{36}$/ },
  scope: { type: scopeSchema, required: false },
  pageContext: { type: pageContextSchema },
  question: textField(800, false),
  message: textField(800, false),
  language: { type: String, enum: AI_LANGUAGES, required: true },
  status: { type: String, enum: ALL_INTERACTION_STATUSES, required: true },
  answer: { type: new Schema({
    text: textField(6000),
    claims: { type: [new Schema({ text: textField(1500, true), citationNs: [Number], sourceRefs: [Number], supported: Boolean }, { _id: false, strict: "throw" })], default: [] },
    missingInfo: [textField(300)],
  }, { _id: false, strict: "throw" }) },
  citations: { type: [citationSchema], default: [] },
  steps: { type: [stepSchema], default: [] },
  sources: { type: [sourceSchema], default: [] },
  toolsUsed: { type: [textField(80)], default: [] },
  cancelRequested: { type: Boolean, default: false },
  evidence: { type: new Schema({
    level: { type: String, enum: Array.from(new Set([...AI_EVIDENCE_LEVELS, "VERIFIED", "PARTIAL", "NONE"])), required: true },
    unverifiedFigures: { type: [String], default: [] },
    droppedClaims: { ...nonNegativeInteger(), default: 0 },
    quotesVerified: { ...nonNegativeInteger(), default: 0 },
    quotesTotal: { ...nonNegativeInteger(), default: 0 },
  }, { _id: false, strict: "throw" }) },
  coverage: { type: new Schema({ documentsInScope: nonNegativeInteger(), documentsSearched: nonNegativeInteger(), documentsNotAiReady: nonNegativeInteger(), truncatedScope: Boolean }, { _id: false, strict: "throw" }) },
  retrieval: { type: new Schema({
    candidates: nonNegativeInteger(), used: nonNegativeInteger(), minScoreUsed: Number, flaggedSuspicious: { ...nonNegativeInteger(), default: 0 }, droppedStale: { ...nonNegativeInteger(), default: 0 }, redactions: { ...nonNegativeInteger(), default: 0 },
  }, { _id: false, strict: "throw" }) },
  model: textField(120), promptVersion: textField(40), pipelineVersion: textField(20),
  usage: { type: new Schema({ inputTokens: { ...nonNegativeInteger(), default: 0 }, outputTokens: { ...nonNegativeInteger(), default: 0 }, estimatedCostMinor: nonNegativeInteger() }, { _id: false, strict: "throw" }) },
  latencyMs: nonNegativeInteger(), errorCode: textField(40),
  feedback: { type: new Schema({ rating: { type: String, enum: AI_FEEDBACK_RATINGS, required: true }, reason: { type: String, enum: AI_FEEDBACK_REASONS }, comment: textField(300) }, { _id: false, strict: "throw" }) },
  expiresAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "aiInteractions" });

interactionSchema.index({ userId: 1, createdAt: -1 });
interactionSchema.index({ userId: 1, threadId: 1, createdAt: 1 });
interactionSchema.index({ agencyId: 1, createdAt: -1 });
interactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AiInteractionDocument = mongoose.InferSchemaType<typeof interactionSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const AiInteraction = (mongoose.models.AiInteraction as mongoose.Model<AiInteractionDocument> | undefined) ?? mongoose.model<AiInteractionDocument>("AiInteraction", interactionSchema);
