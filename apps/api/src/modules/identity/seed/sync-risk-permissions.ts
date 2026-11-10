import type { SystemRoleKey } from "@infraos/shared-types";

import { grantCeiling } from "../admin-roles/admin-role.policy.js";
import { Role } from "../models/role.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "./system-role-permissions.js";

/**
 * The Batch 11 Risk Intelligence grant (risk.resolve).
 * Granted to GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER for project scope operations.
 * SUPER_ADMIN, INSPECTOR, CONTRACTOR, CITIZEN never hold this grant.
 */
export const RISK_BATCH11_GRANTS: Partial<Record<SystemRoleKey, readonly string[]>> = {
  GOV_ADMIN: ["risk.resolve"],
  AGENCY_OFFICER: ["risk.resolve"],
  PROJECT_MANAGER: ["risk.resolve"],
};

const ROLES = Object.keys(RISK_BATCH11_GRANTS) as SystemRoleKey[];

export type RiskSyncPlan = { role: SystemRoleKey; found: boolean; add: string[] };

/** Pure planner: additive only, limited to canonical Batch 11 grants inside each role's policy ceiling. */
export function planRiskSync(role: SystemRoleKey, current: readonly string[] | null): RiskSyncPlan {
  if (!current) return { role, found: false, add: [] };
  const have = new Set(current);
  const ceiling = grantCeiling(role);
  const canonical = new Set<string>(SYSTEM_ROLE_PERMISSIONS[role]);
  return {
    role,
    found: true,
    add: (RISK_BATCH11_GRANTS[role] ?? []).filter(
      (p) => canonical.has(p) && ceiling.has(p) && !have.has(p),
    ),
  };
}

/** $addToSet per system role: idempotent, safe under concurrent runs, cannot remove a grant. Dry run (apply=false) writes nothing. */
export async function syncRiskPermissions(apply: boolean): Promise<(RiskSyncPlan & { applied: boolean })[]> {
  const out: (RiskSyncPlan & { applied: boolean })[] = [];
  for (const key of ROLES) {
    const role = await Role.findOne({ key, isSystem: true }).select("permissions").lean();
    const plan = planRiskSync(key, role ? [...(role.permissions ?? [])] : null);
    let applied = false;
    if (apply && plan.found && plan.add.length) {
      const res = await Role.updateOne(
        { key, isSystem: true },
        { $addToSet: { permissions: { $each: plan.add } } },
      );
      applied = res.modifiedCount === 1;
    }
    out.push({ ...plan, applied });
  }
  return out;
}

