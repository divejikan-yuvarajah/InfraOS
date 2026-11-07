import mongoose, { Schema } from "mongoose";
import { moneySchema, reference, textField } from "../../../shared/database/fields.js";
import { PAYMENT_STATUSES, PAYMENT_TYPES } from "../finance.constants.js";

const reversalSchema = new Schema({ by: reference("User"), at: { type: Date, required: true }, reason: textField(500, true) }, { _id: false, strict: "throw" });

/**
 * Payment tracking inside InfraOS. PAID means an authorised user recorded that a payment was made, with a reference; nothing here moves money.
 * New fields are optional at schema level so legacy rows stay valid; the payment service requires them for new requests.
 */
const projectPaymentSchema = new Schema({
  paymentNo: { ...textField(24), unique: true, sparse: true },
  projectId: reference("Project"),
  agencyId: reference("Agency", false),
  contractorId: reference("Contractor"),
  assignmentId: reference("ContractorAssignment", false),
  amount: { type: moneySchema, required: true },
  paymentType: { type: String, enum: PAYMENT_TYPES, required: true },
  status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "PENDING" },
  invoiceReference: textField(80),
  description: textField(500),
  approvedBy: reference("User", false),
  date: { type: Date, required: true },
  requestedAt: { type: Date },
  decidedAt: { type: Date },
  decisionNote: textField(500),
  paidAt: { type: Date },
  paidBy: reference("User", false),
  paymentReference: textField(80),
  cancelledAt: { type: Date },
  cancelReason: textField(500),
  reversal: { type: reversalSchema },
  /** True for requests that are not REJECTED, CANCELLED or REVERSED: the only rows the duplicate-invoice index covers. */
  dupActive: { type: Boolean },
  // Required for attribution and the submitter/approver duty check.
  createdBy: reference("User"),
}, { timestamps: true, strict: "throw", collection: "projectPayments" });

projectPaymentSchema.pre("validate", function () {
  if (this.createdBy?.equals(this.approvedBy)) {
    this.invalidate("approvedBy", "Payment submitter cannot approve their own payment");
  }
  if (this.isModified("status") && this.status === "PAID" && this.paymentNo && !this.paymentReference) this.invalidate("paymentReference", "A payment reference is required to mark a payment as paid");
});

projectPaymentSchema.index({ projectId: 1, date: -1 });
projectPaymentSchema.index({ contractorId: 1, date: -1 });
projectPaymentSchema.index({ status: 1, date: -1 });
projectPaymentSchema.index({ projectId: 1, contractorId: 1, invoiceReference: 1 }, { unique: true, partialFilterExpression: { dupActive: true }, name: "one_active_invoice_per_contractor_project" });
projectPaymentSchema.index({ agencyId: 1, status: 1, requestedAt: -1 });
projectPaymentSchema.index({ assignmentId: 1, status: 1 });

export type ProjectPaymentDocument = mongoose.InferSchemaType<typeof projectPaymentSchema> & { _id: mongoose.Types.ObjectId };
export const ProjectPayment = (mongoose.models.ProjectPayment as mongoose.Model<ProjectPaymentDocument> | undefined) ?? mongoose.model<ProjectPaymentDocument>("ProjectPayment", projectPaymentSchema);
