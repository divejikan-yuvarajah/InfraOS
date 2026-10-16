import { Schema } from "mongoose";

/** Small schema primitives; domain enums remain in their owning modules. */
export const textField = (maxlength: number, required = false) => ({
  type: String, trim: true, maxlength, required,
});

export const reference = (ref: string, required = true) => ({
  type: Schema.Types.ObjectId, ref, required,
});

export const percentage = () => ({ type: Number, min: 0, max: 100 });

export const nonNegativeInteger = () => ({
  type: Number,
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  validate: { validator: Number.isSafeInteger, message: "Must be a safe integer" },
});

/** LKR cents throughout V1. Do not mix rupees, floats, or Decimal128. */
export const moneySchema = new Schema({
  amountMinor: { ...nonNegativeInteger(), required: true },
  currency: { type: String, enum: ["LKR"], required: true, default: "LKR" },
}, { _id: false, strict: "throw" });

/** Descriptive location only; geometry is the sole coordinate source. */
export const locationSchema = new Schema({
  district: textField(100),
  province: textField(100),
  locality: textField(160),
  roadName: textField(160),
  description: textField(500),
}, { _id: false, strict: "throw" });

export const arrayLimit = (max: number) => ({
  validator: (values: unknown[]) => Array.isArray(values) && values.length <= max,
  message: `Must contain at most ${max} items`,
});

/** Document validation only. Future update services must load/validate full records. */
export function dateOrder(schema: Schema, start: string, end: string): void {
  schema.pre("validate", function () {
    const from: unknown = this.get(start);
    const to: unknown = this.get(end);
    if (from instanceof Date && to instanceof Date && to < from) {
      this.invalidate(end, `${end} must be on or after ${start}`);
    }
  });
}
