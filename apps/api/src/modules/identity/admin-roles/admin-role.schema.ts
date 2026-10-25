import { PERMISSION_CATALOG, isPermission } from "@infraos/shared-types";
import { z } from "zod";

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

const revision = z.number().int().min(0).max(1_000_000);

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasControlChar(value), "control characters");

export const roleMetadataSchema = z
  .object({
    name: safeText(80),
    description: safeText(500),
    revision,
  })
  .strict();

export const rolePermissionsSchema = z
  .object({
    permissions: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(80)
          .refine((value) => isPermission(value) && !value.includes("*"), "unknown permission"),
      )
      .max(PERMISSION_CATALOG.length)
      .refine((values) => new Set(values).size === values.length, "duplicate permission"),
    revision,
    reason: safeText(160).refine((value) => value.length >= 8, "reason is too short"),
  })
  .strict();

export type RoleMetadataInput = z.infer<typeof roleMetadataSchema>;
export type RolePermissionsInput = z.infer<typeof rolePermissionsSchema>;
