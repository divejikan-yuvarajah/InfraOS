import mongoose, { Schema } from "mongoose";

const PURPOSE = "RESET_PASSWORD" as const;

/**
 * Issuance-only challenge for Step 41. Consumption is Step 42.
 * Indexes are declared for a later approved Atlas migration.
 * Do not sync them against Atlas until that approval.
 * A partial unique index on open challenges also matches expired rows
 * until they are revoked or TTL removes them.
 */
const passwordResetChallengeSchema = new Schema(
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
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    collection: "password_reset_challenges",
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

passwordResetChallengeSchema.index({ tokenHash: 1 }, { unique: true });
passwordResetChallengeSchema.index({ userId: 1, purpose: 1, createdAt: -1 });
passwordResetChallengeSchema.index(
  { userId: 1, purpose: 1 },
  {
    unique: true,
    partialFilterExpression: { consumedAt: null, revokedAt: null },
  },
);
passwordResetChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetChallengeDocument = mongoose.InferSchemaType<
  typeof passwordResetChallengeSchema
> & { _id: mongoose.Types.ObjectId };

export const PasswordResetChallenge =
  (mongoose.models.PasswordResetChallenge as
    | mongoose.Model<PasswordResetChallengeDocument>
    | undefined) ??
  mongoose.model<PasswordResetChallengeDocument>(
    "PasswordResetChallenge",
    passwordResetChallengeSchema,
  );
