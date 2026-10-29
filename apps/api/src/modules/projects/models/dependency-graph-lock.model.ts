import mongoose, { Schema } from "mongoose";

export const DEPENDENCY_GRAPH_LOCK_ID = "project-dependency-graph";

const dependencyGraphLockSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, min: 0, default: 0 },
}, { collection: "dependencyGraphLocks", strict: "throw" });

export type DependencyGraphLockDocument = { _id: string; seq: number };
export const DependencyGraphLock = (mongoose.models.DependencyGraphLock as mongoose.Model<DependencyGraphLockDocument> | undefined)
  ?? mongoose.model<DependencyGraphLockDocument>("DependencyGraphLock", dependencyGraphLockSchema);
