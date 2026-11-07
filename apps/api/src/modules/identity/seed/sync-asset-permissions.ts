import type { SystemRoleKey } from "@infraos/shared-types";

import { grantCeiling } from "../admin-roles/admin-role.policy.js";
import { Role } from "../models/role.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "./system-role-permissions.js";

/** The Batch 07 grants. Only these are ever added, so other customizations on stored roles are never touched. */
export const ASSET_BATCH07_GRANTS: Partial<Record<SystemRoleKey, readonly string[]>> = {
  GOV_ADMIN: ["asset.conversion.approve"],
  AGENCY_OFFICER: ["asset.health.read"],
  PROJECT_MANAGER: ["asset.create", "asset.health.read"],
};
const ROLES = Object.keys(ASSET_BATCH07_GRANTS) as SystemRoleKey[];

export type AssetSyncPlan = { role: SystemRoleKey; found: boolean; add: string[] };

/** Pure planner: additive only, limited to canonical Batch 07 grants inside each role's policy ceiling. */
export function planAssetSync(role: SystemRoleKey, current: readonly string[] | null): AssetSyncPlan {
  if (!current) return { role, found: false, add: [] };
  const have = new Set(current);
  const ceiling = grantCeiling(role);
  const canonical = new Set<string>(SYSTEM_ROLE_PERMISSIONS[role]);
  return { role, found: true, add: (ASSET_BATCH07_GRANTS[role] ?? []).filter((p) => canonical.has(p) && ceiling.has(p) && !have.has(p)) };
}

/** $addToSet per system role: idempotent, safe under concurrent runs, cannot remove a grant. Dry run (apply=false) writes nothing. */
export async function syncAssetPermissions(apply: boolean): Promise<(AssetSyncPlan & { applied: boolean })[]> {
  const out: (AssetSyncPlan & { applied: boolean })[] = [];
  for (const key of ROLES) {
    const role = await Role.findOne({ key, isSystem: true }).select("permissions").lean();
    const plan = planAssetSync(key, role ? [...(role.permissions ?? [])] : null);
    let applied = false;
    if (apply && plan.found && plan.add.length) {
      const res = await Role.updateOne({ key, isSystem: true }, { $addToSet: { permissions: { $each: plan.add } } });
      applied = res.modifiedCount === 1;
    }
    out.push({ ...plan, applied });
  }
  return out;
}
