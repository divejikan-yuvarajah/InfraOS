import type { SystemRoleKey } from "@infraos/shared-types";

import { grantCeiling } from "../admin-roles/admin-role.policy.js";
import { Role } from "../models/role.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "./system-role-permissions.js";

/** The Batch 06 reviewer grants. Only these are ever added, so other customizations on stored roles are never touched. */
export const INSPECTION_BATCH06_PERMISSIONS = ["inspection.verify", "inspection.reject"] as const;
const ROLES: readonly SystemRoleKey[] = ["GOV_ADMIN", "AGENCY_OFFICER"];

export type InspectionSyncPlan = { role: SystemRoleKey; found: boolean; add: string[] };

/** Pure planner: additive only, limited to the canonical Batch 06 grants inside each role's policy ceiling. */
export function planInspectionSync(role: SystemRoleKey, current: readonly string[] | null): InspectionSyncPlan {
  if (!current) return { role, found: false, add: [] };
  const have = new Set(current);
  const ceiling = grantCeiling(role);
  const canonical = new Set<string>(SYSTEM_ROLE_PERMISSIONS[role]);
  return { role, found: true, add: INSPECTION_BATCH06_PERMISSIONS.filter((p) => canonical.has(p) && ceiling.has(p) && !have.has(p)) };
}

/** $addToSet per system role: idempotent, safe under concurrent runs, cannot remove a grant. Dry run (apply=false) writes nothing. */
export async function syncInspectionPermissions(apply: boolean): Promise<(InspectionSyncPlan & { applied: boolean })[]> {
  const out: (InspectionSyncPlan & { applied: boolean })[] = [];
  for (const key of ROLES) {
    const role = await Role.findOne({ key, isSystem: true }).select("permissions").lean();
    const plan = planInspectionSync(key, role ? [...(role.permissions ?? [])] : null);
    let applied = false;
    if (apply && plan.found && plan.add.length) {
      const res = await Role.updateOne({ key, isSystem: true }, { $addToSet: { permissions: { $each: plan.add } } });
      applied = res.modifiedCount === 1;
    }
    out.push({ ...plan, applied });
  }
  return out;
}
