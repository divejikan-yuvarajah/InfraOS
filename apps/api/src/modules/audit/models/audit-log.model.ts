import mongoose, { Schema } from "mongoose";
import { isIP } from "node:net";
import { arrayLimit, moneySchema, percentage, reference, textField } from "../../../shared/database/fields.js";
import { AUDIT_RESOURCES } from "../audit.constants.js";

/** Explicit safe snapshot shape. Never pass a request body or full document here. */
const snapshotSchema = new Schema({
  status: { ...textField(40), match: /^[A-Z_]+$/ },
  reason: {
    ...textField(500),
    validate: {
      validator(value: string) {
        if (value.includes("$")) return false;
        for (const char of value) {
          const code = char.charCodeAt(0);
          if (code <= 31 || code === 127) return false;
        }
        return true;
      },
    },
  },
  roleId: reference("Role", false),
  agencyId: reference("Agency", false),
  managerId: reference("User", false),
  dependencyId: reference("ProjectDependency", false),
  prerequisiteProjectId: reference("Project", false),
  contractorId: reference("Contractor", false),
  physicalProgress: percentage(),
  financialProgress: percentage(),
  budget: { type: moneySchema },
  amount: { type: moneySchema },
  cost: { type: moneySchema },
  // Catalog validation belongs to identity; strings here cannot contain bodies.
  permissions: {
    type: [{ type: String, maxlength: 100, match: /^[a-z_]+\.[a-z_.]+$/ }],
    default: undefined,
    validate: arrayLimit(200),
  },
}, { _id: false, strict: "throw" });

const auditLogSchema = new Schema({
  userId: reference("User", false), // Optional only for system-originated actions.
  action: { ...textField(100, true), match: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/ },
  resourceType: { type: String, enum: AUDIT_RESOURCES, required: true },
  resourceId: { type: Schema.Types.ObjectId, required: true },
  oldValue: { type: snapshotSchema, select: false },
  newValue: { type: snapshotSchema, select: false },
  ipAddress: { ...textField(45), select: false, validate: (value: string) => isIP(value) !== 0 },
  userAgent: { ...textField(180), select: false },
  // Correlation and agency scope support governed audit reads later.
  requestId: { ...textField(100), match: /^[A-Za-z0-9_-]+$/ },
  agencyId: reference("Agency", false),
}, {
  timestamps: { createdAt: "timestamp", updatedAt: false },
  strict: "throw", collection: "auditLogs",
  toJSON: {
    transform(_doc, ret: Record<string, unknown>) {
      delete ret.oldValue;
      delete ret.newValue;
      delete ret.ipAddress;
      delete ret.userAgent;
      return ret;
    },
  },
});

function appendOnly(): never {
  throw new Error("AuditLog is append-only");
}

auditLogSchema.pre("save", function () { if (!this.isNew) appendOnly(); });
auditLogSchema.pre(["updateOne", "updateMany", "replaceOne", "findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "deleteOne", "deleteMany"], appendOnly);
auditLogSchema.pre("deleteOne", { document: true, query: false }, appendOnly);
auditLogSchema.pre("bulkWrite", appendOnly);
// Native collection access can bypass ODM hooks; DB privileges remain essential.

auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

export type AuditLogDocument = mongoose.InferSchemaType<typeof auditLogSchema> & { _id: mongoose.Types.ObjectId };
export const AuditLog = (mongoose.models.AuditLog as mongoose.Model<AuditLogDocument> | undefined) ?? mongoose.model<AuditLogDocument>("AuditLog", auditLogSchema);
