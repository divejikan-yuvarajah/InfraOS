import mongoose, { Schema } from "mongoose";
import {
  RISK_RUN_STATUSES,
  RISK_RUN_TRIGGERS,
} from "@infraos/shared-types";

const countersSchema = new Schema(
  {
    considered: { type: Number, default: 0, min: 0 },
    assessed: { type: Number, default: 0, min: 0 },
    unchanged: { type: Number, default: 0, min: 0 },
    notApplicable: { type: Number, default: 0, min: 0 },
    failed: { type: Number, default: 0, min: 0 },
  },
  { _id: false, strict: "throw" },
);

const riskRunSchema = new Schema(
  {
    runId: { type: String, required: true },
    trigger: {
      type: String,
      enum: RISK_RUN_TRIGGERS,
      required: true,
    },
    scope: { type: String, required: true },
    status: {
      type: String,
      enum: RISK_RUN_STATUSES,
      required: true,
      default: "RUNNING",
    },
    counters: {
      type: countersSchema,
      required: true,
      default: () => ({
        considered: 0,
        assessed: 0,
        unchanged: 0,
        notApplicable: 0,
        failed: 0,
      }),
    },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    leaseUntil: { type: Date, default: null },
    errorCode: { type: String, default: null },
  },
  {
    timestamps: false,
    strict: "throw",
    collection: "riskRuns",
  },
);

riskRunSchema.index({ runId: 1 }, { unique: true });
riskRunSchema.index({ status: 1, leaseUntil: 1 });
riskRunSchema.index({ startedAt: -1 });

export type RiskRunDocument = mongoose.InferSchemaType<
  typeof riskRunSchema
> & { _id: mongoose.Types.ObjectId };

export const RiskRun =
  (mongoose.models.RiskRun as mongoose.Model<RiskRunDocument> | undefined) ??
  mongoose.model<RiskRunDocument>("RiskRun", riskRunSchema);

