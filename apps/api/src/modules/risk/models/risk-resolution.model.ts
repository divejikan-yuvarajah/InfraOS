import mongoose, { Schema } from "mongoose";
import {
  arrayLimit,
  reference,
  textField,
} from "../../../shared/database/fields.js";
import {
  RISK_RESOLUTION_STATUSES,
  RISK_SEVERITIES,
} from "@infraos/shared-types";

const resolutionEventSchema = new Schema(
  {
    status: {
      type: String,
      enum: RISK_RESOLUTION_STATUSES,
      required: true,
    },
    note: textField(1000, false),
    by: reference("User", true),
    at: { type: Date, required: true },
    assessmentId: reference("RiskAssessment", false),
  },
  { _id: false, strict: "throw" },
);

const riskResolutionSchema = new Schema(
  {
    projectId: reference("Project", true),
    agencyId: reference("Agency", true),
    fingerprint: { type: String, required: true, maxlength: 120 },
    indicatorCode: { type: String, required: true, maxlength: 40 },
    status: {
      type: String,
      enum: RISK_RESOLUTION_STATUSES,
      required: true,
      default: "OPEN",
    },
    note: textField(1000, true),
    severityAtDecision: {
      type: String,
      enum: RISK_SEVERITIES,
      required: true,
    },
    assessmentId: reference("RiskAssessment", false),
    assignedTo: reference("User", false),
    reviewAt: { type: Date, default: null },
    decidedBy: reference("User", true),
    decidedAt: { type: Date, required: true },
    events: {
      type: [resolutionEventSchema],
      default: [],
      validate: arrayLimit(100),
    },
    version: { type: Number, required: true, default: 1, min: 1 },
  },
  {
    timestamps: true,
    strict: "throw",
    collection: "riskResolutions",
  },
);

riskResolutionSchema.index({ projectId: 1, fingerprint: 1 }, { unique: true });
riskResolutionSchema.index({ agencyId: 1, status: 1 });
riskResolutionSchema.index({ assignedTo: 1, status: 1 });

export type RiskResolutionDocument = Omit<
  mongoose.InferSchemaType<typeof riskResolutionSchema>,
  "assessmentId" | "assignedTo" | "reviewAt"
> & {
  _id: mongoose.Types.ObjectId;
  assessmentId?: mongoose.Types.ObjectId | null;
  assignedTo?: mongoose.Types.ObjectId | null;
  reviewAt?: Date | null;
};

export const RiskResolution =
  (mongoose.models.RiskResolution as
    | mongoose.Model<RiskResolutionDocument>
    | undefined) ??
  mongoose.model<RiskResolutionDocument>(
    "RiskResolution",
    riskResolutionSchema,
  );

