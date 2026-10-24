import mongoose, { Schema } from "mongoose";

/**
 * One document per refresh family. `activeTokenHash` is the only hash that
 * may be rotated. `closedAt` is the logout barrier. A single-document update
 * is the commit point, so a refresh cannot install a new hash after logout.
 * Indexes are declared for a later approved migration. Do not sync them to
 * Atlas until that approval.
 */
const refreshFamilySchema = new Schema(
  {
    familyId: { type: String, required: true, unique: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    closedAt: { type: Date, default: null },
    credentialEpoch: { type: Number, required: true, default: 0, min: 0 },
    activeTokenHash: { type: String, default: null, select: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    collection: "refresh_families",
  },
);

refreshFamilySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshFamilySchema.index({ userId: 1, closedAt: 1 });

export type RefreshFamilyDocument = mongoose.InferSchemaType<typeof refreshFamilySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RefreshFamily =
  (mongoose.models.RefreshFamily as mongoose.Model<RefreshFamilyDocument> | undefined) ??
  mongoose.model<RefreshFamilyDocument>("RefreshFamily", refreshFamilySchema);
