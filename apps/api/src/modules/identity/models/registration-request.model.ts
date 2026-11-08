import mongoose, { Schema } from "mongoose";

export const REQUESTED_RESPONSIBILITY_KEYS = [
  "PROJECT_MANAGEMENT",
  "AGENCY_COORDINATION",
  "ENGINEERING_OPERATIONS",
  "PROJECT_MONITORING",
  "INSTITUTIONAL_ADMIN",
  "OTHER_AUTHORIZED",
] as const;

export type RequestedResponsibilityKey = (typeof REQUESTED_RESPONSIBILITY_KEYS)[number];

export const REGISTRATION_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type RegistrationRequestStatus = (typeof REGISTRATION_REQUEST_STATUSES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegistrationRequestDocument = mongoose.InferSchemaType<
  typeof registrationRequestSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const registrationRequestSchema = new Schema(
  {
    referenceCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 32,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, "email must be a valid email address"],
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
      minlength: 50,
      maxlength: 255,
    },
    organizationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 64,
    },
    organizationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    requestedResponsibility: {
      type: String,
      required: true,
      enum: REQUESTED_RESPONSIBILITY_KEYS,
    },
    status: {
      type: String,
      required: true,
      enum: REGISTRATION_REQUEST_STATUSES,
      default: "PENDING",
      index: true,
    },
    accountStatus: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    assignedRoleId: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },
    assignedAgencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    approvalNotes: {
      type: String,
      trim: true,
      default: null,
    },
    createdUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acceptedTermsAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: "account_registration_requests",
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

registrationRequestSchema.index({ email: 1, status: 1 });

export const RegistrationRequest =
  (mongoose.models.RegistrationRequest as
    | mongoose.Model<RegistrationRequestDocument>
    | undefined) ??
  mongoose.model<RegistrationRequestDocument>(
    "RegistrationRequest",
    registrationRequestSchema,
  );

