import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger, reference, textField } from "../../../../shared/database/fields.js";
import { nextNumber } from "../../../../shared/database/counter.js";

const sha = { type: String, required: true, match: /^[a-f0-9]{64}$/ };

const analysisEvidenceSchema = new Schema(
  {
    evidenceId: reference("InspectionEvidence", true),
    sha256: sha,
    capturedAt: { type: Date, required: true },
    sitePresence: {
      type: new Schema(
        {
          distanceM: { type: Number, required: true },
          status: { type: String, enum: ["ON_SITE", "NEAR_SITE", "AWAY"], required: true },
          basis: { type: String, enum: ["project_geometry", "inspection_site_point"], required: true },
        },
        { _id: false, strict: "throw" },
      ),
      required: false,
    },
  },
  { _id: false, strict: "throw" },
);

const visibleWorkIndicatorSchema = new Schema(
  {
    label: textField(80, true),
    certainty: { type: String, enum: ["CLEAR", "POSSIBLE"], required: true },
  },
  { _id: false, strict: "throw" },
);

const analysisImageResultSchema = new Schema(
  {
    n: { type: Number, required: true, min: 1, max: 6 },
    activityDescription: textField(400, true),
    visibleWorkIndicators: { type: [visibleWorkIndicatorSchema], default: [] },
    qualityIssues: {
      type: [String],
      enum: [
        "BLURRY",
        "DARK",
        "OVEREXPOSED",
        "PARTIAL_VIEW",
        "NO_SCALE_REFERENCE",
        "OBSTRUCTED",
        "LOW_RESOLUTION",
        "OTHER",
      ],
      default: [],
    },
    notes: textField(300),
  },
  { _id: false, strict: "throw" },
);

const potentialDiscrepancySchema = new Schema(
  {
    statement: textField(300, true),
    imageNs: { type: [Number], required: true },
    severity: { type: String, enum: ["LOW", "MODERATE", "HIGH"], required: true },
  },
  { _id: false, strict: "throw" },
);

const analysisResultSchema = new Schema(
  {
    images: { type: [analysisImageResultSchema], required: true },
    overall: {
      type: new Schema(
        {
          consistencyWithReportedStage: {
            type: String,
            enum: ["CONSISTENT", "PARTIALLY_CONSISTENT", "INCONSISTENT", "INDETERMINATE"],
            required: true,
          },
          rationale: textField(600, true),
        },
        { _id: false, strict: "throw" },
      ),
      required: true,
    },
    potentialDiscrepancies: { type: [potentialDiscrepancySchema], default: [] },
    cannotBeDetermined: { type: [String], default: [] },
    questionsForInspector: { type: [String], default: [] },
    droppedStatements: { type: Number, default: 0 },
  },
  { _id: false, strict: "throw" },
);

const qualityCheckItemSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    severity: { type: String, enum: ["INFO", "WARNING", "CRITICAL"], required: true },
    message: textField(300, true),
    evidenceId: { type: String, trim: true },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false, strict: "throw" },
);

const qualityChecksSchema = new Schema(
  {
    checks: { type: [qualityCheckItemSchema], default: [] },
    coverage: {
      type: new Schema(
        {
          totalPhotos: { type: Number, required: true },
          milestonesWithEvidence: { type: Number, required: true },
          totalMilestones: { type: Number, required: true },
          uncoveredMilestones: { type: [String], default: [] },
        },
        { _id: false, strict: "throw" },
      ),
      required: true,
    },
    metadataNote: textField(300, true),
  },
  { _id: false, strict: "throw" },
);

const inspectorDecisionSchema = new Schema(
  {
    decision: { type: String, enum: ["CONFIRMED", "DISPUTED", "NOT_RELEVANT"], required: true },
    comment: textField(300),
  },
  { _id: false, strict: "throw" },
);

const inspectorReviewSchema = new Schema(
  {
    status: { type: String, enum: ["PENDING", "REVIEWED"], required: true, default: "PENDING" },
    decisions: { type: Map, of: inspectorDecisionSchema, default: {} },
    reviewedBy: reference("User", false),
    reviewedAt: Date,
  },
  { _id: false, strict: "throw" },
);

const inspectionAiAnalysisSchema = new Schema(
  {
    analysisNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^AIV-\d{4}-\d{6}$/,
    },
    inspectionId: reference("Inspection", true),
    projectId: reference("Project", true),
    agencyId: reference("Agency", true),
    requestedBy: reference("User", true),
    requestedByRole: { type: String, enum: ["INSPECTOR", "REVIEWER"], required: true },
    evidence: {
      type: [analysisEvidenceSchema],
      required: true,
      validate: (v: unknown[]) => v.length >= 1 && v.length <= 6,
    },
    contextHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    status: {
      type: String,
      enum: ["QUEUED", "RUNNING", "READY", "FAILED"],
      required: true,
      default: "QUEUED",
    },
    errorCode: { type: String, trim: true },
    result: { type: analysisResultSchema },
    qualityChecks: { type: qualityChecksSchema, required: true },
    model: { type: String, trim: true },
    promptVersion: { type: String, required: true, default: "vision.v1" },
    usage: {
      type: new Schema(
        {
          inputTokens: { ...nonNegativeInteger(), default: 0 },
          outputTokens: { ...nonNegativeInteger(), default: 0 },
          images: { ...nonNegativeInteger(), default: 0 },
          estimatedCostMinor: { ...nonNegativeInteger() },
        },
        { _id: false, strict: "throw" },
      ),
      default: { inputTokens: 0, outputTokens: 0, images: 0 },
    },
    inspectorReview: { type: inspectorReviewSchema, default: { status: "PENDING", decisions: {} } },
    supersededBy: reference("InspectionAiAnalysis", false),
    leaseExpiresAt: Date,
  },
  { timestamps: true, strict: "throw", collection: "inspectionAiAnalyses" },
);

inspectionAiAnalysisSchema.index({ inspectionId: 1, createdAt: -1 });
inspectionAiAnalysisSchema.index({ agencyId: 1, createdAt: -1 });
inspectionAiAnalysisSchema.index(
  { inspectionId: 1, contextHash: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["QUEUED", "RUNNING", "READY"] } },
  },
);

export async function nextAnalysisNo(now = new Date(), session?: mongoose.ClientSession): Promise<string> {
  return nextNumber("AIV", now, session);
}

export type InspectionAiAnalysisDocument = mongoose.InferSchemaType<typeof inspectionAiAnalysisSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const InspectionAiAnalysis =
  (mongoose.models.InspectionAiAnalysis as mongoose.Model<InspectionAiAnalysisDocument> | undefined) ??
  mongoose.model<InspectionAiAnalysisDocument>("InspectionAiAnalysis", inspectionAiAnalysisSchema);

