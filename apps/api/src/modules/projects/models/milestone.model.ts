import mongoose, { Schema } from "mongoose";
import { dateOrder, percentage, reference, textField } from "../../../shared/database/fields.js";
import { MILESTONE_STATUSES } from "../project.constants.js";

const milestoneSchema = new Schema({
  projectId: reference("Project"),
  title: textField(200, true),
  description: textField(2000),
  plannedStart: { type: Date, required: true },
  plannedEnd: { type: Date, required: true },
  actualStart: { type: Date },
  actualEnd: { type: Date },
  progress: { ...percentage(), required: true, default: 0 },
  status: { type: String, enum: MILESTONE_STATUSES, required: true, default: "NOT_STARTED" },
}, { timestamps: true, strict: "throw", collection: "milestones" });

dateOrder(milestoneSchema, "plannedStart", "plannedEnd");
dateOrder(milestoneSchema, "actualStart", "actualEnd");

milestoneSchema.index({ projectId: 1, plannedEnd: 1 });

export type MilestoneDocument = mongoose.InferSchemaType<typeof milestoneSchema> & { _id: mongoose.Types.ObjectId };
export const Milestone = (mongoose.models.Milestone as mongoose.Model<MilestoneDocument> | undefined) ?? mongoose.model<MilestoneDocument>("Milestone", milestoneSchema);
