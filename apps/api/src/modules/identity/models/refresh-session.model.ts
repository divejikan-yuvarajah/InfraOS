import mongoose, { Schema } from "mongoose";

export type RefreshSessionDocument = mongoose.InferSchemaType<
  typeof refreshSessionSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const refreshSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
      minlength: 20,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBySessionId: {
      type: Schema.Types.ObjectId,
      ref: "RefreshSession",
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    userAgentSummary: {
      type: String,
      default: null,
      maxlength: 180,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    collection: "refresh_sessions",
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession =
  (mongoose.models.RefreshSession as
    | mongoose.Model<RefreshSessionDocument>
    | undefined) ??
  mongoose.model<RefreshSessionDocument>(
    "RefreshSession",
    refreshSessionSchema,
  );
