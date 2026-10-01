import mongoose, { Schema } from "mongoose";
import { AGENCY_STATUSES, AGENCY_TYPES } from "@infraos/shared-types";

export type AgencyDocument = mongoose.InferSchemaType<typeof agencySchema> & {
  _id: mongoose.Types.ObjectId;
};

const agencySchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
      match: [/^[A-Z0-9_]+$/, "agency code must be uppercase letters, digits, or underscore"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    shortName: {
      type: String,
      default: null,
      trim: true,
      maxlength: 40,
    },
    type: {
      type: String,
      required: true,
      enum: AGENCY_TYPES,
      index: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    contactEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    contactPhone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 32,
    },
    address: {
      type: String,
      default: null,
      trim: true,
      maxlength: 240,
    },
    status: {
      type: String,
      required: true,
      enum: AGENCY_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    parentAgencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: "agencies",
  },
);

agencySchema.index({ name: 1 });

agencySchema.pre("validate", function preventSelfParent(next) {
  const parent = this.parentAgencyId;
  if (parent && this._id && parent.equals(this._id)) {
    next(new Error("Agency cannot be its own parent"));
    return;
  }
  next();
});

export const Agency =
  (mongoose.models.Agency as mongoose.Model<AgencyDocument> | undefined) ??
  mongoose.model<AgencyDocument>("Agency", agencySchema);
