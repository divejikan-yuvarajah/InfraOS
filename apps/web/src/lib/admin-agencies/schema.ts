import { z } from "zod";

const name = z.string().trim().min(1).max(160);

export const agencyCreateFormSchema = z
  .object({
    code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_]+$/),
    name,
    type: z.enum(["MINISTRY", "DEPARTMENT", "ROAD", "WATER", "OTHER"]),
    parentAgencyId: z.string().trim().regex(/^[a-f0-9]{24}$/i).or(z.literal("")),
  })
  .strict();

export type AgencyCreateFormValues = z.infer<typeof agencyCreateFormSchema>;

/** Display hint only. The API decides governance. */
export function agencyManageIsPlatformHint(roleKey: string | null | undefined): boolean {
  return roleKey === "SUPER_ADMIN";
}
