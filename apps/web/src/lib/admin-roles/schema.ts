import { z } from "zod";

export const roleMetadataFormSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(500),
  })
  .strict();

export const rolePermissionsFormSchema = z
  .object({
    permissions: z.array(z.string().trim().min(3).max(80)).max(200),
    reason: z.string().trim().min(8).max(160),
  })
  .strict();

/** Display hint only. The API decides governance. */
export function roleManageIsPlatformHint(roleKey: string | null | undefined): boolean {
  return roleKey === "SUPER_ADMIN";
}
