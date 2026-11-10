import mongoose, { Schema } from "mongoose";
import { nonNegativeInteger } from "../../../shared/database/fields.js";

const rateBucketSchema = new Schema({
  key: { type: String, required: true },
  count: { ...nonNegativeInteger(), default: 1 },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  strict: "throw",
  collection: "aiRateBuckets",
});

rateBucketSchema.index({ key: 1 }, { unique: true });
rateBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AiRateBucketDocument = mongoose.InferSchemaType<typeof rateBucketSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AiRateBucket =
  (mongoose.models.AiRateBucket as mongoose.Model<AiRateBucketDocument> | undefined) ??
  mongoose.model<AiRateBucketDocument>("AiRateBucket", rateBucketSchema);
