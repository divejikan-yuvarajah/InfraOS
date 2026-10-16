import mongoose, { Schema } from "mongoose";
import { arrayLimit, locationSchema, reference, textField } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { ISSUE_CATEGORIES, ISSUE_PRIORITIES, ISSUE_STATUSES } from "../issue.constants.js";

// Citizen photos are private storage metadata, not project Document records.
const photoSchema = new Schema({
  storageKey: textField(512, true),
  fileName: textField(255, true),
}, { _id: false, strict: "throw" });

const citizenIssueSchema = new Schema({
  citizenId: reference("User"),
  category: { type: String, enum: ISSUE_CATEGORIES, required: true },
  description: textField(5000, true),
  location: { type: locationSchema, required: true },
  geometry: geometryField(),
  photos: { type: [photoSchema], default: [], select: false, validate: arrayLimit(10) },
  assignedAgency: reference("Agency", false),
  status: { type: String, enum: ISSUE_STATUSES, required: true, default: "SUBMITTED" },
  priority: { type: String, enum: ISSUE_PRIORITIES, required: true, default: "NORMAL" },
}, {
  timestamps: true, strict: "throw", collection: "citizenIssues",
  toJSON: {
    transform(_doc, ret: Record<string, unknown>) {
      delete ret.photos;
      return ret;
    },
  },
});

export type CitizenIssueDocument = mongoose.InferSchemaType<typeof citizenIssueSchema> & { _id: mongoose.Types.ObjectId };
export const CitizenIssue = (mongoose.models.CitizenIssue as mongoose.Model<CitizenIssueDocument> | undefined) ?? mongoose.model<CitizenIssueDocument>("CitizenIssue", citizenIssueSchema);
