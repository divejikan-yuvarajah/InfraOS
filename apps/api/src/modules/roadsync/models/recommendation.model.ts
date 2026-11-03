import mongoose, { Schema } from "mongoose";
import { reference } from "../../../shared/database/fields.js";
import { RoadsyncCounter } from "./conflict-record.model.js";

/**
 * Step 80: a cached advisor snapshot for ONE audience (an agency, or "national"). Scores, bands, counts, ids and i18n
 * codes + params only. Server-owned. Snapshots are never reused across audiences.
 */
const feedbackSchema = new Schema({
  userId: reference("User"), agencyId: reference("Agency"),
  planKey: { type: String, default: null, maxlength: 24 },
  action: { type: String, enum: ["helpful", "not_helpful", "dismissed", "handoff_used", "restored"], required: true },
  reasonCode: { type: String, default: null, maxlength: 40 },
  at: { type: Date, required: true },
}, { _id: false });

const recommendationSchema = new Schema({
  recNo: { type: String, required: true, match: /^RSX-\d{4}-\d{6}$/ },
  scope: { type: new Schema({ type: { type: String, enum: ["conflict", "request"], required: true }, conflictId: { type: Schema.Types.ObjectId, default: null }, requestId: { type: Schema.Types.ObjectId, default: null } }, { _id: false }), required: true },
  audienceKey: { type: String, required: true, maxlength: 30 },
  generatedForUserId: reference("User"),
  advisorVersion: { type: String, required: true, maxlength: 12 },
  ruleVersion: { type: String, required: true, maxlength: 12 },
  inputsHash: { type: String, required: true, maxlength: 64 },
  generatedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ["fresh", "stale", "superseded"], required: true, default: "fresh" },
  result: { type: Schema.Types.Mixed, required: true },
  feedback: { type: [feedbackSchema], default: [] },
  version: { type: Number, required: true, default: 1 },
}, { timestamps: true, strict: "throw", collection: "roadsync_recommendations", minimize: false });

recommendationSchema.index({ recNo: 1 }, { unique: true });
recommendationSchema.index({ "scope.conflictId": 1, "scope.requestId": 1, audienceKey: 1, advisorVersion: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "fresh" } });
recommendationSchema.index({ audienceKey: 1, generatedAt: -1 });
recommendationSchema.index({ "feedback.userId": 1 });

export type RecommendationDocument = mongoose.InferSchemaType<typeof recommendationSchema> & { _id: mongoose.Types.ObjectId };
export const Recommendation = (mongoose.models.RoadsyncRecommendation as mongoose.Model<RecommendationDocument> | undefined) ?? mongoose.model<RecommendationDocument>("RoadsyncRecommendation", recommendationSchema);

/** Atomic sequence (never a count): RSX-<year>-<6 digits>. */
export async function nextRecNo(now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const row = await RoadsyncCounter.findOneAndUpdate({ _id: `RSX-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return `RSX-${year}-${String(row!.seq).padStart(6, "0")}`;
}
