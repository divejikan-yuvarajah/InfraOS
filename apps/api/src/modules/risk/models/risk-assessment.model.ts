import mongoose, { Schema } from "mongoose";
import {
  arrayLimit,
  percentage,
  reference,
  textField,
} from "../../../shared/database/fields.js";
import {
  RISK_CHANGE_TYPES,
  RISK_EVIDENCE_BASES,
  RISK_FACTOR_CATEGORIES,
  RISK_LEVELS,
  RISK_SEVERITIES,
  RISK_SUFFICIENCY_LEVELS,
  RISK_TRIGGER_TYPES,
} from "@infraos/shared-types";

const factorSchema = new Schema(
  {
    category: { type: String, enum: RISK_FACTOR_CATEGORIES, required: true },
    description: textField(1000, true),
    score: { ...percentage(), required: true },
  },
  { _id: false, strict: "throw" },
);

const categorySchema = new Schema(
  {
    category: { type: String, enum: RISK_FACTOR_CATEGORIES, required: true },
    level: { type: String, enum: RISK_LEVELS, required: true },
    index: { ...percentage(), required: false },
    sufficiency: {
      type: String,
      enum: RISK_SUFFICIENCY_LEVELS,
      required: true,
    },
    missing: { type: [String], default: [] },
  },
  { _id: false, strict: "throw" },
);

const evidenceRefSchema = new Schema(
  {
    kind: { type: String, required: true },
    ref: {
      type: new Schema(
        {
          type: { type: String, required: true },
          id: { type: String, required: true },
          label: { type: String, default: null },
        },
        { _id: false },
      ),
      required: true,
    },
    value: { type: Schema.Types.Mixed, default: null },
    unit: { type: String, default: null },
    asOf: { type: String, default: null },
  },
  { _id: false },
);

const calcSchema = new Schema(
  {
    formulaKey: { type: String, required: true },
    steps: { type: [String], default: [] },
  },
  { _id: false },
);

const indicatorSchema = new Schema(
  {
    code: { type: String, required: true },
    category: { type: String, enum: RISK_FACTOR_CATEGORIES, required: true },
    severity: { type: String, enum: RISK_SEVERITIES, required: true },
    points: { type: Number, min: 0, max: 100, required: true },
    fingerprint: { type: String, required: true },
    subjectKey: { type: String, default: null },
    titleKey: { type: String, required: true },
    explainKey: { type: String, required: true },
    inputs: { type: Schema.Types.Mixed, default: {} },
    evidence: { type: [evidenceRefSchema], default: [] },
    calc: { type: calcSchema, default: null },
    basis: { type: String, enum: RISK_EVIDENCE_BASES, required: true },
    firstSeenAt: { type: Date, default: null },
    durationDays: { type: Number, min: 0, default: null },
  },
  { _id: false, strict: "throw" },
);

const freshnessSchema = new Schema(
  {
    source: { type: String, required: true },
    available: { type: Boolean, required: true },
    asOf: { type: Date, default: null },
    stale: { type: Boolean, default: false },
    reasonKey: { type: String, default: null },
  },
  { _id: false, strict: "throw" },
);

const changeSchema = new Schema(
  {
    type: { type: String, enum: RISK_CHANGE_TYPES, required: true },
    code: { type: String, required: true },
    fingerprint: { type: String, required: true },
    from: { type: String, enum: RISK_SEVERITIES, default: null },
    to: { type: String, enum: RISK_SEVERITIES, default: null },
  },
  { _id: false, strict: "throw" },
);

const narrativeSchema = new Schema(
  {
    text: { type: String, required: true, maxlength: 4000 },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    language: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    verified: { type: Boolean, required: true },
  },
  { _id: false, strict: "throw" },
);

function validateRecommendations(val: unknown[]): boolean {
  if (!Array.isArray(val)) return false;
  if (val.length > 20) return false;
  for (const item of val) {
    if (typeof item === "string") {
      if (item.length > 1000) return false;
    } else if (typeof item === "object" && item !== null) {
      const rec = item as { code?: unknown; priority?: unknown };
      if (!rec.code || typeof rec.code !== "string") return false;
      if (!rec.priority || typeof rec.priority !== "string") return false;
    } else {
      return false;
    }
  }
  return true;
}

const riskAssessmentSchema = new Schema(
  {
    assessmentNo: {
      type: String,
      required: false, // Optional for legacy records, populated for all Batch 11 assessments
      match: /^RSK-\d{4}-\d{6}$/,
      index: { unique: true, sparse: true },
    },
    projectId: reference("Project", true),
    agencyId: reference("Agency", false),
    projectStatus: { type: String, default: "ACTIVE" },
    trigger: {
      type: String,
      enum: RISK_TRIGGER_TYPES,
      default: "ON_DEMAND",
    },
    engineVersion: { type: String, default: "r1" },
    inputsHash: { type: String, maxlength: 64, default: "" },
    applicable: { type: Boolean, default: true },
    overallLevel: {
      type: String,
      enum: RISK_LEVELS,
      default: "NOT_ASSESSABLE",
    },
    overallIndex: { ...percentage(), required: false },
    categories: { type: [categorySchema], default: [] },
    indicators: {
      type: [indicatorSchema],
      default: [],
      validate: arrayLimit(60),
    },
    sourceFreshness: { type: [freshnessSchema], default: [] },
    missingData: { type: [String], default: [] },
    recommendations: {
      type: [Schema.Types.Mixed],
      default: [],
      validate: {
        validator: validateRecommendations,
        message: "Must contain at most 20 valid recommendations",
      },
    },
    changes: { type: [changeSchema], default: [] },
    levelChange: {
      type: new Schema(
        {
          from: { type: String, enum: RISK_LEVELS },
          to: { type: String, enum: RISK_LEVELS },
        },
        { _id: false },
      ),
      default: null,
    },
    previousAssessmentId: reference("RiskAssessment", false),
    narrative: { type: narrativeSchema, default: null },
    requestedBy: reference("User", false),

    // Legacy backward-compatible fields: relaxed to optional percentages
    overallRisk: { ...percentage(), required: false },
    delayRisk: { ...percentage(), required: false },
    budgetRisk: { ...percentage(), required: false },
    scheduleRisk: { ...percentage(), required: false },
    factors: { type: [factorSchema], default: [], validate: arrayLimit(50) },
    modelVersion: {
      type: String,
      match: /^[A-Za-z0-9_.:-]+$/,
      default: "r1",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: "throw",
    collection: "riskAssessments",
  },
);

riskAssessmentSchema.index({ projectId: 1, createdAt: -1 });
riskAssessmentSchema.index({ agencyId: 1, createdAt: -1 });
riskAssessmentSchema.index({ overallLevel: 1, createdAt: -1 });
riskAssessmentSchema.index({ projectId: 1, inputsHash: 1 });

// Append-only integrity: block all updates except attaching a narrative to an existing assessment
riskAssessmentSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  function (next) {
    const update = this.getUpdate() as Record<string, unknown> | undefined;
    if (!update) {
      return next(new Error("Risk assessments are append-only"));
    }
    const directKeys = Object.keys(update).filter((k) => !k.startsWith("$"));
    if (directKeys.length > 0) {
      return next(
        new Error("Risk assessments are append-only and cannot be updated"),
      );
    }
    const dollarKeys = Object.keys(update).filter((k) => k.startsWith("$"));
    for (const op of dollarKeys) {
      if (op !== "$set") {
        return next(
          new Error("Risk assessments are append-only; only $set is allowed"),
        );
      }
    }
    const setOp = update.$set as Record<string, unknown> | undefined;
    if (setOp) {
      const keys = Object.keys(setOp);
      const hasForbidden = keys.some(
        (k) => k !== "narrative" && !k.startsWith("narrative."),
      );
      if (hasForbidden) {
        return next(
          new Error(
            "Risk assessments are append-only; only narrative may be added",
          ),
        );
      }
    }
    next();
  },
);

riskAssessmentSchema.pre("save", function (next) {
  if (!this.isNew) {
    const modified = this.modifiedPaths();
    const forbidden = modified.filter(
      (p) => p !== "narrative" && !p.startsWith("narrative."),
    );
    if (forbidden.length > 0) {
      return next(
        new Error(
          "Risk assessments are append-only; existing records cannot be edited",
        ),
      );
    }
  }
  next();
});

export type RiskAssessmentDocument = mongoose.InferSchemaType<
  typeof riskAssessmentSchema
> & { _id: mongoose.Types.ObjectId };

export const RiskAssessment =
  (mongoose.models.RiskAssessment as
    | mongoose.Model<RiskAssessmentDocument>
    | undefined) ??
  mongoose.model<RiskAssessmentDocument>(
    "RiskAssessment",
    riskAssessmentSchema,
  );

/** Atomic sequence per key (e.g. "RSK-2026"). Never derived from a count. */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { strict: "throw", collection: "risk_counters" },
);

export const RiskCounter =
  (mongoose.models.RiskCounter as
    | mongoose.Model<{ _id: string; seq: number }>
    | undefined) ??
  mongoose.model<{ _id: string; seq: number }>(
    "RiskCounter",
    counterSchema,
  );

export async function nextAssessmentNo(now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const row = await RiskCounter.findOneAndUpdate(
    { _id: `RSK-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean();
  return `RSK-${year}-${String(row!.seq).padStart(6, "0")}`;
}
