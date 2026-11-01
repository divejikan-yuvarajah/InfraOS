import { grantCeiling } from "../admin-roles/admin-role.policy.js";
import { Role } from "../models/role.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "./system-role-permissions.js";

export type SuperAdminSyncPlan = {
  found: boolean;
  /** Canonical grants missing from the stored role. These are the only changes ever written. */
  add: string[];
  /** Stored grants outside the policy ceiling. Reported for review, never removed automatically. */
  aboveCeiling: string[];
  unchangedCount: number;
};

/** Pure planner: additive only, so unrelated customizations on the stored role are preserved. */
export function planSuperAdminSync(current: readonly string[] | null): SuperAdminSyncPlan {
  if (!current) return { found: false, add: [], aboveCeiling: [], unchangedCount: 0 };
  const have = new Set(current);
  const ceiling = grantCeiling("SUPER_ADMIN");
  const add = SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN.filter((permission) => !have.has(permission) && ceiling.has(permission));
  const aboveCeiling = current.filter((permission) => !ceiling.has(permission));
  return { found: true, add: [...add], aboveCeiling, unchangedCount: current.length };
}

/**
 * Touches only the SUPER_ADMIN system role document. $addToSet makes the write idempotent,
 * safe under concurrent runs, and unable to drop existing permissions. Users and every other
 * role are never read or written. Dry run (apply=false) performs no write.
 */
export async function syncSuperAdminPermissions(apply: boolean): Promise<SuperAdminSyncPlan & { applied: boolean }> {
  const role = await Role.findOne({ key: "SUPER_ADMIN", isSystem: true }).select("permissions").lean();
  const plan = planSuperAdminSync(role ? [...(role.permissions ?? [])] : null);
  if (!apply || !plan.found || plan.add.length === 0) return { ...plan, applied: false };
  const result = await Role.updateOne(
    { key: "SUPER_ADMIN", isSystem: true },
    { $addToSet: { permissions: { $each: plan.add } } },
  );
  return { ...plan, applied: result.modifiedCount === 1 };
}
