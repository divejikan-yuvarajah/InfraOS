import mongoose, { Schema } from "mongoose";
import { reference, textField } from "../../../shared/database/fields.js";

const integerPercent = {
  type: Number,
  required: true,
  min: 0,
  max: 100,
  validate: Number.isInteger,
};

const progressReportSchema = new Schema({
  projectId: reference("Project"),
  sequence: { type: Number, required: true, min: 1, validate: Number.isInteger },
  reportedPercent: integerPercent,
  previousPercent: integerPercent,
  note: textField(2000, true),
  reporterUserId: reference("User"),
  reportedAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "progressReports" });

function appendOnly(): never {
  throw new Error("ProgressReport is append-only");
}

progressReportSchema.pre("save", function () { if (!this.isNew) appendOnly(); });
progressReportSchema.pre(["updateOne", "updateMany", "replaceOne", "findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "deleteOne", "deleteMany"], appendOnly);
progressReportSchema.pre("deleteOne", { document: true, query: false }, appendOnly);
progressReportSchema.pre("bulkWrite", appendOnly);

progressReportSchema.index({ projectId: 1, sequence: -1 });
progressReportSchema.index({ projectId: 1, sequence: 1 }, { unique: true });

export type ProgressReportDocument = mongoose.InferSchemaType<typeof progressReportSchema> & { _id: mongoose.Types.ObjectId };
export const ProgressReport = (mongoose.models.ProgressReport as mongoose.Model<ProgressReportDocument> | undefined) ?? mongoose.model<ProgressReportDocument>("ProgressReport", progressReportSchema);
