import { z } from "zod";

export const adminRegistrationListQuerySchema = z
  .object({
    status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).optional().default("PENDING"),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AdminRegistrationListQuery = z.infer<typeof adminRegistrationListQuerySchema>;

export const adminRegistrationApproveSchema = z
  .object({
    roleKey: z.enum([
      "SUPER_ADMIN",
      "GOV_ADMIN",
      "AGENCY_OFFICER",
      "PROJECT_MANAGER",
      "CONTRACTOR",
      "INSPECTOR",
      "CITIZEN",
    ]),
    agencyCode: z.string().trim().max(64).optional(),
    agencyId: z.string().regex(/^[0-9a-fA-F]{24}$/, "invalid agencyId format").optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type AdminRegistrationApproveInput = z.infer<typeof adminRegistrationApproveSchema>;

export const adminRegistrationRejectSchema = z
  .object({
    reason: z.string().trim().min(3, "Rejection reason must be at least 3 characters").max(500),
  })
  .strict();

export type AdminRegistrationRejectInput = z.infer<typeof adminRegistrationRejectSchema>;

