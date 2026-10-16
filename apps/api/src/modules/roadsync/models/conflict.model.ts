import mongoose, { Schema } from "mongoose";
import { reference, textField } from "../../../shared/database/fields.js";
import { CONFLICT_SEVERITIES, CONFLICT_STATUSES, CONFLICT_TYPES } from "../roadsync.constants.js";

const conflictSchema = new Schema({
  workRequestA: reference("WorkRequest"),
  workRequestB: reference("WorkRequest"),
  conflictType: { type: String, enum: CONFLICT_TYPES, required: true },
  // Metres, not degrees; measured by the later deterministic engine.
  distance: { type: Number, min: 0, validate: Number.isFinite },
  scheduleOverlap: { type: Boolean, required: true },
  severity: { type: String, enum: CONFLICT_SEVERITIES, required: true },
  status: { type: String, enum: CONFLICT_STATUSES, required: true, default: "OPEN" },
  resolution: textField(4000),
  resolvedBy: reference("User", false),
  resolvedAt: { type: Date },
  // Derived from the normalized work-request pair while a conflict is active.
  activePairKey: { type: String, maxlength: 49, match: /^[a-f0-9]{24}:[a-f0-9]{24}$/ },
}, { timestamps: true, strict: "throw", collection: "conflicts" });

conflictSchema.pre("validate", function () {
  const left = this.workRequestA;
  const right = this.workRequestB;
  if (!left || !right) return;
  if (left.equals(right)) {
    this.invalidate("workRequestB", "A work request cannot conflict with itself");
    return;
  }
  if (left.toHexString() > right.toHexString()) {
    this.workRequestA = right;
    this.workRequestB = left;
  }
  const active = ["OPEN", "COORDINATION_PENDING", "UNDER_REVIEW"].includes(this.status);
  this.activePairKey = active
    ? `${this.workRequestA.toHexString()}:${this.workRequestB.toHexString()}`
    : undefined;
});

conflictSchema.index({ status: 1, severity: 1, createdAt: -1 });
conflictSchema.index(
  { activePairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activePairKey: { $type: "string" } },
    name: "uniq_active_conflict_pair",
  },
);

export type ConflictDocument = mongoose.InferSchemaType<typeof conflictSchema> & { _id: mongoose.Types.ObjectId };
export const Conflict = (mongoose.models.Conflict as mongoose.Model<ConflictDocument> | undefined) ?? mongoose.model<ConflictDocument>("Conflict", conflictSchema);
