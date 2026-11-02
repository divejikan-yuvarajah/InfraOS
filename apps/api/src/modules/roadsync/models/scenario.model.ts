import mongoose, { Schema } from "mongoose";
import { reference } from "../../../shared/database/fields.js";

/**
 * Step 79: a saved simulator scenario. A snapshot only: the levers the user chose plus the scores, bands and counts the
 * server computed when it was saved. Never contains another agency's request fields. Server-owned.
 */
const scenarioSchema = new Schema({
  conflictId: reference("RoadsyncConflictRecord"),
  conflictNo: { type: String, required: true, maxlength: 20 },
  name: { type: String, required: true, maxlength: 80 },
  visibility: { type: String, enum: ["private", "agency", "national"], required: true, default: "private" },
  ownerUserId: reference("User"),
  ownerAgencyId: reference("Agency"),
  levers: { type: [Schema.Types.Mixed], default: [] },
  result: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true, strict: "throw", collection: "roadsync_scenarios", minimize: false });
scenarioSchema.index({ conflictId: 1, createdAt: -1 });

export type ScenarioDocument = mongoose.InferSchemaType<typeof scenarioSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const Scenario = (mongoose.models.RoadsyncScenario as mongoose.Model<ScenarioDocument> | undefined) ?? mongoose.model<ScenarioDocument>("RoadsyncScenario", scenarioSchema);
