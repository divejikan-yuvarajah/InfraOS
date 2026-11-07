import mongoose, { Schema, type ClientSession } from "mongoose";

/** Generic atomic sequence per key (e.g. "PAY-2026"). Never derived from a count; safe under concurrency and inside a transaction. */
const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, required: true, default: 0 } }, { strict: "throw", collection: "counters" });
export const Counter = (mongoose.models.Counter as mongoose.Model<{ _id: string; seq: number }> | undefined) ?? mongoose.model<{ _id: string; seq: number }>("Counter", counterSchema);

/** `PREFIX-YYYY-NNNNNN` using the UTC year of `now`. */
export async function nextNumber(prefix: string, now = new Date(), session?: ClientSession): Promise<string> {
  const year = now.getUTCFullYear();
  const row = await Counter.findOneAndUpdate({ _id: `${prefix}-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true, ...(session ? { session } : {}) }).lean();
  return `${prefix}-${year}-${String(row!.seq).padStart(6, "0")}`;
}
