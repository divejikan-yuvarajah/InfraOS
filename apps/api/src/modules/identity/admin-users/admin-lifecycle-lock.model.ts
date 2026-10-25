import mongoose, { Schema } from "mongoose";

/**
 * Single-document mutex so disable, enable, and role/agency assignment
 * serialize on a replica set. The counter is not an authorization grant.
 */
const adminLifecycleLockSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { strict: true, collection: "admin_lifecycle_locks" },
);

type LockDocument = { key: string; seq: number };

export const AdminLifecycleLock: mongoose.Model<LockDocument> =
  (mongoose.models.AdminLifecycleLock as mongoose.Model<LockDocument> | undefined) ??
  mongoose.model<LockDocument>("AdminLifecycleLock", adminLifecycleLockSchema);

export const USER_LIFECYCLE_LOCK = "user-lifecycle";
export const AGENCY_HIERARCHY_LOCK = "agency-hierarchy";
