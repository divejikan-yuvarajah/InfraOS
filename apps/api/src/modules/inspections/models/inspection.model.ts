import mongoose, { Schema } from "mongoose";
import { arrayLimit, percentage, reference, textField } from "../../../shared/database/fields.js";
import {
  CHECKLIST_RESULTS, DECISIONS, DEFECT_SEVERITIES, INSPECTION_PRIORITIES, INSPECTION_STATUSES, INSPECTION_TYPES,
} from "../inspection.constants.js";

const pct = { type: Number, min: 0, max: 100, validate: Number.isInteger };
const key = { type: String, required: true, trim: true, maxlength: 60, match: /^[a-z0-9_]+$/ };

const checklistEntry = new Schema({ key, result: { type: String, enum: CHECKLIST_RESULTS, required: true, default: "NOT_CHECKED" }, note: textField(500) }, { _id: false, strict: "throw" });
const defectEntry = new Schema({
  key, title: textField(160, true), description: textField(1000),
  severity: { type: String, enum: DEFECT_SEVERITIES, required: true }, location: textField(200),
  reworkRequired: { type: Boolean, required: true, default: false },
}, { _id: false, strict: "throw" });
const followUpCheck = new Schema({ parentInspectionId: reference("Inspection"), defectKey: key, resolved: { type: Boolean, required: true }, note: textField(500) }, { _id: false, strict: "throw" });
const milestoneAssessment = new Schema({ milestoneId: reference("Milestone"), verifiedProgress: { ...pct, required: true }, note: textField(500) }, { _id: false, strict: "throw" });

/** Working copy of the report. `revision` is the optimistic-concurrency token for autosave. */
export const reportSchema = new Schema({
  revision: { type: Number, required: true, default: 0, min: 0 },
  checklistVersion: textField(10),
  checklist: { type: [checklistEntry], default: [], validate: arrayLimit(40) },
  siteObservations: textField(4000),
  workCompletionObservations: textField(4000),
  safetyObservations: textField(3000),
  defects: { type: [defectEntry], default: [], validate: arrayLimit(30) },
  followUpChecks: { type: [followUpCheck], default: [], validate: arrayLimit(30) },
  recommendations: textField(3000),
  followUpRequired: { type: Boolean, default: false },
  followUpNote: textField(1000),
  measuredProgress: pct,
  milestoneAssessments: { type: [milestoneAssessment], default: [], validate: arrayLimit(10) },
  discrepancyNote: textField(1000),
  inspectorDeclaration: { type: Boolean, default: false },
  // ASSET_CONDITION inspections only: the inspector's rating. The asset condition changes only when a reviewer approves.
  conditionRating: { type: String, enum: ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"] },
}, { _id: false, strict: "throw" });

const decision = new Schema({
  decision: { type: String, enum: DECISIONS, required: true }, by: reference("User"), at: { type: Date, required: true }, note: textField(500),
  itemComments: { type: [new Schema({ itemKey: key, comment: textField(500, true) }, { _id: false, strict: "throw" })], default: [], validate: arrayLimit(40) },
}, { _id: false, strict: "throw" });

const submission = new Schema({
  no: { type: Number, required: true, min: 1 }, submittedAt: { type: Date, required: true }, submittedBy: reference("User"),
  reportSnapshot: { type: reportSchema, required: true }, decision: { type: decision },
}, { _id: false, strict: "throw" });

const assignmentEntry = new Schema({ inspectorId: reference("User"), assignedBy: reference("User"), assignedAt: { type: Date, required: true }, reason: textField(500) }, { _id: false, strict: "throw" });
const rescheduleEntry = new Schema({ from: { type: Date, required: true }, to: { type: Date, required: true }, by: reference("User"), at: { type: Date, required: true }, reason: textField(500, true) }, { _id: false, strict: "throw" });

const pointSchema = new Schema({ type: { type: String, enum: ["Point"], required: true }, coordinates: { type: [Number], required: true, validate: (v: number[]) => v.length === 2 && Math.abs(v[0]!) <= 180 && Math.abs(v[1]!) <= 90 } }, { _id: false, strict: "throw" });

const inspectionSchema = new Schema({
  inspectionNo: { type: String, trim: true, maxlength: 24, match: /^INS-\d{4}-\d{6}$/ },
  projectId: reference("Project"),
  agencyId: reference("Agency", false),
  inspectorId: reference("User"),
  inspectionDate: { type: Date, required: true },
  inspectionType: { type: String, enum: INSPECTION_TYPES, default: "PROGRESS_VERIFICATION" },
  purpose: textField(500),
  priority: { type: String, enum: INSPECTION_PRIORITIES, default: "NORMAL" },
  locationNote: textField(300),
  sitePoint: { type: pointSchema },
  durationMinutes: { type: Number, min: 15, max: 480, default: 120 },
  milestoneIds: { type: [reference("Milestone")], default: [], validate: arrayLimit(10) },
  followUpOfId: reference("Inspection", false),
  assetId: reference("Asset", false),
  claimedProgressAtSchedule: percentage(),
  scheduledBy: reference("User", false),
  assignmentHistory: { type: [assignmentEntry], default: [], validate: arrayLimit(20) },
  rescheduleHistory: { type: [rescheduleEntry], default: [], validate: arrayLimit(20) },
  // Unset until approved; it is the inspector's approved measurement, never a claim.
  physicalProgress: percentage(),
  status: { type: String, enum: INSPECTION_STATUSES, required: true, default: "SCHEDULED" },
  notes: textField(5000),
  evidence: { type: [reference("Document")], default: [], validate: arrayLimit(50) },
  report: { type: reportSchema },
  submissions: { type: [submission], default: [], validate: arrayLimit(6) },
  startedAt: Date, submittedAt: Date, reviewedBy: reference("User", false), reviewedAt: Date, completedAt: Date,
  cancelReason: textField(500), cancelledBy: reference("User", false),
  contractorIdsAtInspection: { type: [reference("Contractor")], default: [], validate: arrayLimit(20) },
  version: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, strict: "throw", collection: "inspections" });

inspectionSchema.index({ projectId: 1, inspectionDate: -1 });
inspectionSchema.index({ inspectorId: 1, status: 1, inspectionDate: -1 });
inspectionSchema.index({ inspectionNo: 1 }, { unique: true, sparse: true });
inspectionSchema.index({ agencyId: 1, status: 1, inspectionDate: 1 });
inspectionSchema.index({ projectId: 1, status: 1, inspectionDate: -1 });
inspectionSchema.index({ status: 1, submittedAt: 1 });
inspectionSchema.index({ followUpOfId: 1 });
inspectionSchema.index({ contractorIdsAtInspection: 1, status: 1 });

export type InspectionDocument = mongoose.InferSchemaType<typeof inspectionSchema> & { _id: mongoose.Types.ObjectId };
export const Inspection = (mongoose.models.Inspection as mongoose.Model<InspectionDocument> | undefined) ?? mongoose.model<InspectionDocument>("Inspection", inspectionSchema);
