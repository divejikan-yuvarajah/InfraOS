import mongoose, { Schema } from "mongoose";
import { moneySchema, reference } from "../../../shared/database/fields.js";
import { PAYMENT_STATUSES, PAYMENT_TYPES } from "../finance.constants.js";

const projectPaymentSchema = new Schema({
  projectId: reference("Project"),
  contractorId: reference("Contractor"),
  amount: { type: moneySchema, required: true },
  paymentType: { type: String, enum: PAYMENT_TYPES, required: true },
  status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "PENDING" },
  approvedBy: reference("User", false),
  date: { type: Date, required: true },
  // Required for attribution and the future submitter/approver duty check.
  createdBy: reference("User"),
}, { timestamps: true, strict: "throw", collection: "projectPayments" });

projectPaymentSchema.pre("validate", function () {
  if (this.createdBy?.equals(this.approvedBy)) {
    this.invalidate("approvedBy", "Payment submitter cannot approve their own payment");
  }
});

projectPaymentSchema.index({ projectId: 1, date: -1 });
projectPaymentSchema.index({ contractorId: 1, date: -1 });
projectPaymentSchema.index({ status: 1, date: -1 });

export type ProjectPaymentDocument = mongoose.InferSchemaType<typeof projectPaymentSchema> & { _id: mongoose.Types.ObjectId };
export const ProjectPayment = (mongoose.models.ProjectPayment as mongoose.Model<ProjectPaymentDocument> | undefined) ?? mongoose.model<ProjectPaymentDocument>("ProjectPayment", projectPaymentSchema);
