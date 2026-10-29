import mongoose, { Schema } from "mongoose";

import { reference } from "../../../shared/database/fields.js";

const projectDependencySchema = new Schema({
  projectId: reference("Project"),
  prerequisiteProjectId: reference("Project"),
  agencyId: reference("Agency"),
  type: { type: String, enum: ["PREREQUISITE"], required: true },
  createdBy: reference("User"),
  removedAt: { type: Date, default: null },
  removedBy: reference("User", false),
}, {
  timestamps: true,
  strict: "throw",
  collection: "projectDependencies",
});

projectDependencySchema.index(
  { projectId: 1, prerequisiteProjectId: 1 },
  { unique: true, partialFilterExpression: { removedAt: null } },
);
projectDependencySchema.index({ projectId: 1, removedAt: 1, createdAt: 1 });
projectDependencySchema.index({ agencyId: 1, removedAt: 1 });

export type ProjectDependencyDocument = mongoose.InferSchemaType<typeof projectDependencySchema> & {
  _id: mongoose.Types.ObjectId;
  __v: number;
};
export const ProjectDependency = (mongoose.models.ProjectDependency as mongoose.Model<ProjectDependencyDocument> | undefined)
  ?? mongoose.model<ProjectDependencyDocument>("ProjectDependency", projectDependencySchema);
