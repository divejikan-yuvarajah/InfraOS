import mongoose, { Schema } from "mongoose";

import { reference, textField } from "../../../shared/database/fields.js";
import { geometryField } from "../../../shared/database/geometry.js";
import { HAZARD_LEVELS, HAZARD_SOURCE_KINDS, HAZARD_TYPES, HAZARD_VISIBILITIES } from "../hazard.constants.js";

const sourceSchema = new Schema({
  kind: { type: String, enum: HAZARD_SOURCE_KINDS, required: true },
  organisation: textField(200, true),
  datasetName: textField(200, true),
  // Required for anything that is not the DEMO set.
  licence: { ...textField(500), required: function (this: { kind?: string }) { return this.kind !== "DEMO"; } },
  url: textField(500),
  dataDate: { type: Date },
  retrievedAt: { type: Date, required: true },
  notes: textField(1000),
}, { _id: false, strict: "throw" });

/**
 * Hazard zones are read-only reference data for InfraMap. They arrive through the provenance-enforcing import script
 * or the labelled DEMO seed; there is no create/update API.
 */
const hazardZoneSchema = new Schema({
  name: textField(200, true),
  description: textField(1000),
  hazardType: { type: String, enum: HAZARD_TYPES, required: true },
  level: { type: String, enum: HAZARD_LEVELS, required: true },
  geometry: geometryField(true),
  agencyId: reference("Agency", false),
  visibility: { type: String, enum: HAZARD_VISIBILITIES, required: true, default: "ALL_STAFF" },
  source: { type: sourceSchema, required: true },
  externalId: textField(200),
  isDemo: { type: Boolean, required: true, default: false },
}, { timestamps: true, strict: "throw", collection: "hazardZones" });

hazardZoneSchema.index({ geometry: "2dsphere" });
hazardZoneSchema.index({ hazardType: 1, level: 1 });
hazardZoneSchema.index({ isDemo: 1 });
hazardZoneSchema.index({ "source.datasetName": 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: "string" } } });

export type HazardZoneDocument = mongoose.InferSchemaType<typeof hazardZoneSchema> & { _id: mongoose.Types.ObjectId };
export const HazardZone = (mongoose.models.HazardZone as mongoose.Model<HazardZoneDocument> | undefined) ?? mongoose.model<HazardZoneDocument>("HazardZone", hazardZoneSchema);
