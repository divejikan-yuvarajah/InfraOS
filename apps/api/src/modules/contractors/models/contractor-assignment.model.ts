import mongoose, { Schema } from "mongoose";
import { dateOrder, moneySchema, reference, textField } from "../../../shared/database/fields.js";
import { ASSIGNMENT_ROLES, ASSIGNMENT_STATUSES } from "../contractor.constants.js";

/**
 * The project-contractor association. Rows are ended or replaced, never deleted, so history survives.
 * Project.contractorId is a denormalised pointer to the current ACTIVE PRIMARY and is written only by the assignment service.
 * Batch 05 payments reference `_id`; Batch 06 inspections use projectId plus the [startDate, endDate] window.
 */
const assignmentSchema = new Schema({
  projectId: reference("Project"),
  contractorId: reference("Contractor"),
  agencyId: reference("Agency"),
  role: { type: String, enum: ASSIGNMENT_ROLES, required: true },
  status: { type: String, enum: ASSIGNMENT_STATUSES, required: true, default: "ACTIVE" },
  contractReference: textField(80),
  contractValue: { type: moneySchema },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  endReason: textField(500),
  assignedBy: reference("User"),
  endedBy: reference("User", false),
  replacedByAssignmentId: reference("ContractorAssignment", false),
  notes: textField(1000),
}, { timestamps: true, strict: "throw", collection: "contractorAssignments" });

dateOrder(assignmentSchema, "startDate", "endDate");
assignmentSchema.pre("validate", function () {
  // Backfilled rows for COMPLETED/CANCELLED projects carry a system reason, so this holds for every non-ACTIVE row.
  if (this.status !== "ACTIVE" && !this.endReason) this.invalidate("endReason", "endReason is required when an assignment is not ACTIVE");
});

assignmentSchema.index({ projectId: 1 }, { unique: true, partialFilterExpression: { role: "PRIMARY", status: "ACTIVE" }, name: "one_active_primary_per_project" });
assignmentSchema.index({ projectId: 1, contractorId: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "one_active_pair_per_project" });
assignmentSchema.index({ contractorId: 1, status: 1, startDate: -1 });
assignmentSchema.index({ agencyId: 1, status: 1 });

export type ContractorAssignmentDocument = mongoose.InferSchemaType<typeof assignmentSchema> & { _id: mongoose.Types.ObjectId };
export const ContractorAssignment = (mongoose.models.ContractorAssignment as mongoose.Model<ContractorAssignmentDocument> | undefined) ?? mongoose.model<ContractorAssignmentDocument>("ContractorAssignment", assignmentSchema);
