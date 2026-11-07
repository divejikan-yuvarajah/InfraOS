import mongoose, { Schema } from "mongoose";
import { EXPENSE_STATUSES, FINANCE_CATEGORIES } from "@infraos/shared-types";
import { arrayLimit, moneySchema, reference, textField } from "../../../shared/database/fields.js";

const reversalSchema = new Schema({ by: reference("User"), at: { type: Date, required: true }, reason: textField(500, true) }, { _id: false, strict: "throw" });

/** Verified expenses are immutable: corrections are reversals that keep the row, and a corrected expense is entered fresh. */
const expenseSchema = new Schema({
  expenseNo: { ...textField(24, true), unique: true },
  projectId: reference("Project"),
  agencyId: reference("Agency"),
  category: { type: String, enum: FINANCE_CATEGORIES, required: true },
  description: textField(500, true),
  expenseDate: { type: Date, required: true },
  amount: { type: moneySchema, required: true },
  contractorId: reference("Contractor", false),
  assignmentId: reference("ContractorAssignment", false),
  supplierName: textField(120),
  supportingRef: textField(80, true),
  documentIds: { type: [reference("Document")], default: [], validate: arrayLimit(10) },
  status: { type: String, enum: EXPENSE_STATUSES, required: true, default: "DRAFT" },
  submittedAt: { type: Date },
  verifiedBy: reference("User", false),
  verifiedAt: { type: Date },
  rejectionReason: textField(500),
  reversal: { type: reversalSchema },
  /** Server-owned hash of normalised project, supplier, supporting reference and amount. */
  duplicateKey: textField(80, true),
  /** True while PENDING_VERIFICATION or VERIFIED: the only rows the duplicate index covers. */
  dupActive: { type: Boolean },
  createdBy: reference("User"),
}, { timestamps: true, strict: "throw", collection: "projectExpenses" });

expenseSchema.pre("validate", function () {
  if (!(this.amount?.amountMinor > 0)) this.invalidate("amount", "amount must be positive");
  if (this.createdBy?.equals(this.verifiedBy)) this.invalidate("verifiedBy", "The creator cannot verify their own expense");
});

expenseSchema.index({ duplicateKey: 1 }, { unique: true, partialFilterExpression: { dupActive: true }, name: "one_active_expense_per_key" });
expenseSchema.index({ projectId: 1, status: 1, expenseDate: -1 });
expenseSchema.index({ agencyId: 1, status: 1 });
expenseSchema.index({ contractorId: 1, expenseDate: -1 });
expenseSchema.index({ category: 1, projectId: 1 });

export type ProjectExpenseDocument = mongoose.InferSchemaType<typeof expenseSchema> & { _id: mongoose.Types.ObjectId };
export const ProjectExpense = (mongoose.models.ProjectExpense as mongoose.Model<ProjectExpenseDocument> | undefined) ?? mongoose.model<ProjectExpenseDocument>("ProjectExpense", expenseSchema);
