import mongoose, { Schema } from "mongoose";
import { FINANCE_CATEGORIES } from "@infraos/shared-types";
import { arrayLimit, moneySchema, reference, textField } from "../../../shared/database/fields.js";

export const BUDGET_REVISION_KINDS = ["INITIAL", "REVISION"] as const;
export const BUDGET_REVISION_STATUS_LIST = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"] as const;

const allocationSchema = new Schema({
  category: { type: String, enum: FINANCE_CATEGORIES, required: true },
  amount: { type: moneySchema, required: true },
}, { _id: false, strict: "throw" });

/**
 * Append-only budget ledger. Project.budget is the latest APPROVED newTotal and is written only by the budget service.
 * Rows are never deleted; the only permitted update is the decision on a PENDING_APPROVAL row (enforced by the filter hook below).
 */
const revisionSchema = new Schema({
  projectId: reference("Project"),
  agencyId: reference("Agency"),
  sequence: { type: Number, required: true, min: 1, validate: Number.isInteger },
  kind: { type: String, enum: BUDGET_REVISION_KINDS, required: true },
  status: { type: String, enum: BUDGET_REVISION_STATUS_LIST, required: true },
  previousTotal: { type: moneySchema, required: true },
  newTotal: { type: moneySchema, required: true },
  allocations: { type: [allocationSchema], default: [], validate: arrayLimit(15) },
  reason: textField(500),
  requestedBy: reference("User", false),
  requestedAt: { type: Date, required: true },
  decidedBy: reference("User", false),
  decidedAt: { type: Date },
  decisionNote: textField(500),
  supersededBy: reference("ProjectBudgetRevision", false),
}, { timestamps: true, strict: "throw", collection: "projectBudgetRevisions" });

revisionSchema.pre("validate", function () {
  if (!(this.newTotal?.amountMinor > 0)) this.invalidate("newTotal", "newTotal must be positive");
  const cats = this.allocations.map((a) => a.category);
  if (new Set(cats).size !== cats.length) this.invalidate("allocations", "duplicate category");
  const sum = this.allocations.reduce((s, a) => s + BigInt(a.amount.amountMinor), 0n);
  if (sum > BigInt(this.newTotal?.amountMinor ?? 0)) this.invalidate("allocations", "allocations exceed the new total");
  if (this.kind === "REVISION" && (this.reason ?? "").length < 12) this.invalidate("reason", "a reason of at least 12 characters is required");
  if (this.status === "REJECTED" && (this.decisionNote ?? "").length < 12) this.invalidate("decisionNote", "a rejection note is required");
});

function appendOnly(): never { throw new Error("ProjectBudgetRevision is append-only"); }
revisionSchema.pre("save", function () { if (!this.isNew) appendOnly(); });
revisionSchema.pre(["replaceOne", "findOneAndReplace", "findOneAndDelete", "deleteOne", "deleteMany"], appendOnly);
revisionSchema.pre("bulkWrite", appendOnly);
// Decisions are atomic updates that must name the PENDING_APPROVAL state in their filter, so a decided row can never change.
revisionSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  if ((this.getFilter() as { status?: unknown }).status !== "PENDING_APPROVAL") appendOnly();
});

revisionSchema.index({ projectId: 1, sequence: 1 }, { unique: true });
revisionSchema.index({ projectId: 1 }, { unique: true, partialFilterExpression: { status: "PENDING_APPROVAL" }, name: "one_pending_revision_per_project" });
revisionSchema.index({ agencyId: 1, status: 1 });

export type ProjectBudgetRevisionDocument = mongoose.InferSchemaType<typeof revisionSchema> & { _id: mongoose.Types.ObjectId };
export const ProjectBudgetRevision = (mongoose.models.ProjectBudgetRevision as mongoose.Model<ProjectBudgetRevisionDocument> | undefined) ?? mongoose.model<ProjectBudgetRevisionDocument>("ProjectBudgetRevision", revisionSchema);
