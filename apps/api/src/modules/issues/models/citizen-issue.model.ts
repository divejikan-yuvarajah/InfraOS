import mongoose, { Schema } from "mongoose";
import { arrayLimit, locationSchema, nonNegativeInteger, reference, textField } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { ISSUE_CATEGORIES, ISSUE_PRIORITIES, ISSUE_STATUSES } from "../issue.constants.js";

// Citizen photos are private storage metadata, not project Document records.
const photoSchema = new Schema({
  storageKey: textField(512, true),
  fileName: textField(255, true),
  mimeType: textField(64),
  sizeBytes: nonNegativeInteger(),
  exifStripped: { type: Boolean, default: true },
}, { _id: false, strict: "throw" });

const statusHistorySchema = new Schema({
  fromStatus: { type: String, enum: ISSUE_STATUSES },
  toStatus: { type: String, enum: ISSUE_STATUSES, required: true },
  changedBy: reference("User", false),
  note: textField(500),
  changedAt: { type: Date, required: true, default: () => new Date() },
}, { _id: false, strict: "throw" });

const internalNoteSchema = new Schema({
  authorId: reference("User", true),
  body: textField(2000, true),
  createdAt: { type: Date, required: true, default: () => new Date() },
}, { _id: false, strict: "throw" });

const publicMessageSchema = new Schema({
  authorLabel: textField(120, true),
  body: textField(1500, true),
  createdAt: { type: Date, required: true, default: () => new Date() },
}, { _id: false, strict: "throw" });

const contactSchema = new Schema({
  name: textField(120),
  phone: textField(40),
  email: textField(160),
}, { _id: false, strict: "throw" });

const citizenIssueSchema = new Schema({
  citizenId: reference("User", false),
  referenceNo: { ...textField(40), unique: true, sparse: true, immutable: true },
  trackingSecretHash: { ...textField(128), select: false },
  category: { type: String, enum: ISSUE_CATEGORIES, required: true },
  title: textField(200),
  description: textField(5000, true),
  location: { type: locationSchema, required: true },
  geometry: geometryField(),
  photos: { type: [photoSchema], default: [], select: false, validate: arrayLimit(4) },
  contact: { type: contactSchema, select: false },
  assignedAgency: reference("Agency", false),
  linkedProjectId: reference("Project", false),
  duplicateOfIssueId: reference("CitizenIssue", false),
  publicMapVisible: { type: Boolean, required: true, default: false },
  status: { type: String, enum: ISSUE_STATUSES, required: true, default: "SUBMITTED" },
  priority: { type: String, enum: ISSUE_PRIORITIES, required: true, default: "NORMAL" },
  statusHistory: { type: [statusHistorySchema], default: [] },
  internalNotes: { type: [internalNoteSchema], default: [], select: false },
  publicMessages: { type: [publicMessageSchema], default: [] },
  isDemo: { type: Boolean, default: false },
}, {
  timestamps: true, strict: "throw", collection: "citizenIssues",
  toJSON: {
    transform(_doc, ret: Record<string, unknown>) {
      delete ret.photos;
      delete ret.trackingSecretHash;
      delete ret.contact;
      delete ret.internalNotes;
      return ret;
    },
  },
});

citizenIssueSchema.index({ assignedAgency: 1, status: 1, createdAt: -1 });
citizenIssueSchema.index({ citizenId: 1, createdAt: -1 });
citizenIssueSchema.index({ status: 1, priority: 1 });
citizenIssueSchema.index({ publicMapVisible: 1, status: 1 });
citizenIssueSchema.index({ geometry: "2dsphere" });

export type CitizenIssueDocument = mongoose.InferSchemaType<typeof citizenIssueSchema> & { _id: mongoose.Types.ObjectId };
export const CitizenIssue = (mongoose.models.CitizenIssue as mongoose.Model<CitizenIssueDocument> | undefined) ?? mongoose.model<CitizenIssueDocument>("CitizenIssue", citizenIssueSchema);
