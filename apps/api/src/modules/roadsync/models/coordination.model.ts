import mongoose, { Schema } from "mongoose";
import { reference } from "../../../shared/database/fields.js";
import { REQUEST_STATUSES } from "../coordination.rules.js";

/**
 * Steps 74-75: one coordination request per proposal thread on a conflict record. Server-owned; nothing is accepted
 * from clients. Rounds, participants and events stay Mixed so Steps 76-77 can extend them without a reshape.
 */
const requestSchema = new Schema({
  requestNo: { type: String, required: true, match: /^RSQ-\d{4}-\d{6}$/ },
  conflictId: reference("RoadsyncConflictRecord"),
  conflictNo: { type: String, required: true, maxlength: 20 },
  pairKey: { type: String, required: true, maxlength: 120 },
  type: { type: String, required: true, maxlength: 30 },
  summary: { type: String, required: true, maxlength: 1000 },
  initiator: { type: Schema.Types.Mixed, required: true },
  participants: { type: [Schema.Types.Mixed], default: [] },
  participantAgencyIds: { type: [Schema.Types.ObjectId], default: [] },
  deadlineAt: { type: Date, required: true },
  warnings: { type: [String], default: [] },
  currentRound: { type: Number, required: true, default: 1 },
  maxRounds: { type: Number, required: true },
  rounds: { type: [Schema.Types.Mixed], default: [] },
  status: { type: String, enum: REQUEST_STATUSES, required: true, default: "awaiting_response" },
  escalated: { type: Schema.Types.Mixed, default: null },
  agreedTerms: { type: Schema.Types.Mixed, default: null },
  nudges: { type: [Schema.Types.Mixed], default: [] },
  extensions: { type: [Schema.Types.Mixed], default: [] },
  events: { type: [Schema.Types.Mixed], default: [] },
  version: { type: Number, required: true, default: 1 },
  closedAt: { type: Date, default: null },
}, { timestamps: true, strict: "throw", collection: "roadsync_coordination_requests", minimize: false });

requestSchema.index({ requestNo: 1 }, { unique: true });
requestSchema.index({ conflictId: 1, status: 1 });
requestSchema.index({ "participants.agencyId": 1, status: 1, deadlineAt: 1 });
requestSchema.index({ "initiator.agencyId": 1, status: 1 });
requestSchema.index({ status: 1, updatedAt: -1 });

export type CoordinationDocument = mongoose.InferSchemaType<typeof requestSchema> & { _id: mongoose.Types.ObjectId };
export const CoordinationRequest = (mongoose.models.RoadsyncCoordinationRequest as mongoose.Model<CoordinationDocument> | undefined) ?? mongoose.model<CoordinationDocument>("RoadsyncCoordinationRequest", requestSchema);

const messageSchema = new Schema({
  requestId: reference("RoadsyncCoordinationRequest"),
  conflictId: reference("RoadsyncConflictRecord"),
  authorUserId: reference("User"),
  authorAgencyId: reference("Agency"),
  text: { type: String, required: true, maxlength: 1000 },
  kind: { type: String, enum: ["message"], default: "message" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "roadsync_coordination_messages" });
messageSchema.index({ requestId: 1, _id: 1 });
export const CoordinationMessage = (mongoose.models.RoadsyncCoordinationMessage as mongoose.Model<mongoose.InferSchemaType<typeof messageSchema>> | undefined) ?? mongoose.model("RoadsyncCoordinationMessage", messageSchema);

const readSchema = new Schema({
  requestId: reference("RoadsyncCoordinationRequest"),
  userId: reference("User"),
  lastSeenAt: { type: Date, required: true },
  lastSeenMessageId: { type: Schema.Types.ObjectId, default: null },
  snapshot: { type: Schema.Types.Mixed, default: null },
}, { strict: "throw", collection: "roadsync_coordination_reads" });
readSchema.index({ requestId: 1, userId: 1 }, { unique: true });
export const CoordinationRead = (mongoose.models.RoadsyncCoordinationRead as mongoose.Model<mongoose.InferSchemaType<typeof readSchema>> | undefined) ?? mongoose.model("RoadsyncCoordinationRead", readSchema);
