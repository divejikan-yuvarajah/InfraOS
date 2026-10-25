import { USER_STATUSES, type SystemRoleKey } from "@infraos/shared-types";
import { z } from "zod";

import { staffProvisionSchema } from "../registration.schema.js";

const revision = z.number().int().min(0).max(1_000_000);

export const adminUserCreateSchema = staffProvisionSchema;

export const adminUserNamePatchSchema = z
  .object({
    firstName: staffProvisionSchema.shape.firstName,
    lastName: staffProvisionSchema.shape.lastName,
    revision,
  })
  .strict();

export const adminUserRevisionSchema = z
  .object({
    revision,
  })
  .strict();

export const adminUserAssignmentSchema = z
  .object({
    revision,
    roleKey: staffProvisionSchema.shape.roleKey.optional(),
    agencyCode: staffProvisionSchema.shape.agencyCode.optional(),
  })
  .strict()
  .refine((value) => value.roleKey !== undefined || value.agencyCode !== undefined, {
    message: "assignment is empty",
  });

const LIST_KEYS = new Set(["page", "pageSize", "q", "status"]);

export type AdminUserListQuery = {
  page: number;
  pageSize: number;
  q: string | null;
  status: (typeof USER_STATUSES)[number] | null;
};

export function parseAdminUserListQuery(input: unknown): AdminUserListQuery | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!LIST_KEYS.has(key) || key.startsWith("$")) return null;
  }
  const pageRaw = record.page == null || record.page === "" ? "1" : String(record.page);
  const sizeRaw = record.pageSize == null || record.pageSize === "" ? "20" : String(record.pageSize);
  if (!/^\d+$/.test(pageRaw) || !/^\d+$/.test(sizeRaw)) return null;
  const page = Number(pageRaw);
  const pageSize = Number(sizeRaw);
  if (page < 1 || page > 10_000 || pageSize < 1 || pageSize > 25) return null;
  let q: string | null = null;
  if (record.q != null && record.q !== "") {
    q = String(record.q).trim();
    if (q.length > 80) return null;
  }
  let status: AdminUserListQuery["status"] = null;
  if (record.status != null && record.status !== "") {
    const value = String(record.status);
    if (!USER_STATUSES.includes(value as (typeof USER_STATUSES)[number])) return null;
    status = value as AdminUserListQuery["status"];
  }
  return { page, pageSize, q, status };
}

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema> & {
  roleKey: SystemRoleKey;
};
export type AdminUserNamePatchInput = z.infer<typeof adminUserNamePatchSchema>;
export type AdminUserRevisionInput = z.infer<typeof adminUserRevisionSchema>;
export type AdminUserAssignmentInput = z.infer<typeof adminUserAssignmentSchema>;
