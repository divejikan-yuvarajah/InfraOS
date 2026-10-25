import { z } from "zod";

const name = z.string().trim().min(1).max(80);

export const adminUserCreateFormSchema = z
  .object({
    firstName: name,
    lastName: name,
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(72),
    roleKey: z.enum(["AGENCY_OFFICER", "PROJECT_MANAGER", "CONTRACTOR", "INSPECTOR"]),
    agencyCode: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9_]+$/),
  })
  .strict();

export type AdminUserCreateFormValues = z.infer<typeof adminUserCreateFormSchema>;

/** Display hint only. The API decides access. */
export function adminDirectoryIsStaffHint(roleKey: string | null | undefined): boolean {
  return roleKey === "SUPER_ADMIN" || roleKey === "GOV_ADMIN" || roleKey === "AGENCY_OFFICER";
}
