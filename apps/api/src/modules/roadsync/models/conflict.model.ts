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
}, { timestamps: true, strict: "throw", collection: "conflicts" });

conflictSchema.pre("validate", function () {
  if (this.workRequestA?.equals(this.workRequestB)) {
    this.invalidate("workRequestB", "A work request cannot conflict with itself");
  }
});

export type ConflictDocument = mongoose.InferSchemaType<typeof conflictSchema> & { _id: mongoose.Types.ObjectId };
export const Conflict = (mongoose.models.Conflict as mongoose.Model<ConflictDocument> | undefined) ?? mongoose.model<ConflictDocument>("Conflict", conflictSchema);
