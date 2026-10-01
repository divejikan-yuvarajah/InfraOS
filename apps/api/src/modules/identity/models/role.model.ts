import mongoose, { Schema } from "mongoose";
import {
  SCOPE_TYPES,
  SYSTEM_ROLE_KEYS,
  isPermission,
  isPermissionFormat,
  type ScopeType,
  type SystemRoleKey,
} from "@infraos/shared-types";

export type RoleDocument = mongoose.InferSchemaType<typeof roleSchema> & {
  _id: mongoose.Types.ObjectId;
};

function permissionsAreValid(values: string[]): boolean {
  const unique = new Set(values);
  if (unique.size !== values.length) {
    return false;
  }
  return values.every(
    (value) => isPermissionFormat(value) && isPermission(value),
  );
}

const roleSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      enum: SYSTEM_ROLE_KEYS,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    permissions: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: permissionsAreValid,
        message:
          "permissions must be unique catalog keys in resource.action format",
      },
    },
    scopeType: {
      type: String,
      required: true,
      enum: SCOPE_TYPES,
    },
    isSystem: {
      type: Boolean,
      required: true,
      default: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: "roles",
  },
);

roleSchema.index({ isActive: 1 });

export const Role =
  (mongoose.models.Role as mongoose.Model<RoleDocument> | undefined) ??
  mongoose.model<RoleDocument>("Role", roleSchema);

export type { ScopeType, SystemRoleKey };
