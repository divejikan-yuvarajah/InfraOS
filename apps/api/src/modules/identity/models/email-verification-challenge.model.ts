import mongoose, { Schema } from "mongoose";

const PURPOSE = "VERIFY_EMAIL" as const;

const emailVerificationChallengeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    purpose: {
      type: String,
      required: true,
      enum: [PURPOSE],
      default: PURPOSE,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
      minlength: 64,
      maxlength: 64,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    issuedAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    collection: "email_verification_challenges",
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

emailVerificationChallengeSchema.index({ tokenHash: 1 }, { unique: true });
emailVerificationChallengeSchema.index({ userId: 1, purpose: 1, createdAt: -1 });
emailVerificationChallengeSchema.index(
  { userId: 1, purpose: 1 },
  {
    unique: true,
    partialFilterExpression: { usedAt: null, revokedAt: null },
  },
);
emailVerificationChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationChallenge =
  (mongoose.models.EmailVerificationChallenge as
    | mongoose.Model<mongoose.InferSchemaType<typeof emailVerificationChallengeSchema>>
    | undefined) ??
  mongoose.model("EmailVerificationChallenge", emailVerificationChallengeSchema);
