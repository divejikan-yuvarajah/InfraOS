import mongoose, { Schema } from "mongoose";
import { reference, textField } from "../../../shared/database/fields.js";
import { COORDINATION_STATUSES } from "../roadsync.constants.js";

const coordinationRequestSchema = new Schema({
  conflictId: reference("Conflict"),
  fromAgency: reference("Agency"),
  toAgency: reference("Agency"),
  message: textField(4000, true),
  status: { type: String, enum: COORDINATION_STATUSES, required: true, default: "PENDING" },
  response: textField(4000),
}, { timestamps: true, strict: "throw", collection: "coordinationRequests" });

export type CoordinationRequestDocument = mongoose.InferSchemaType<typeof coordinationRequestSchema> & { _id: mongoose.Types.ObjectId };
export const CoordinationRequest = (mongoose.models.CoordinationRequest as mongoose.Model<CoordinationRequestDocument> | undefined) ?? mongoose.model<CoordinationRequestDocument>("CoordinationRequest", coordinationRequestSchema);
