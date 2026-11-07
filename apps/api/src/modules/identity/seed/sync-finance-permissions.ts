import type { SystemRoleKey } from "@infraos/shared-types";

import { grantCeiling } from "../admin-roles/admin-role.policy.js";
import { Role } from "../models/role.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "./system-role-permissions.js";

/** The Batch 05 grants. Only these are ever added, so other customizations on stored roles are never touched. */
export const FINANCE_BATCH05_PERMISSIONS = ["finance.budget.approve", "finance.expense.read", "finance.expense.create", "finance.expense.verify"] as const;
const ROLES: readonly SystemRoleKey[] = ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"];

export type FinanceSyncPlan = { role: SystemRoleKey; found: boolean; add: string[] };

/** Pure planner: additive only, limited to canonical Batch 05 grants inside each role's policy ceiling. */
export function planFinanceSync(role: SystemRoleKey, current: readonly string[] | null): FinanceSyncPlan {
  if (!current) return { role, found: false, add: [] };
  const have = new Set(current);
  const ceiling = grantCeiling(role);
  const canonical = new Set<string>(SYSTEM_ROLE_PERMISSIONS[role]);
  return { role, found: true, add: FINANCE_BATCH05_PERMISSIONS.filter((p) => canonical.has(p) && ceiling.has(p) && !have.has(p)) };
}

/** $addToSet per system role: idempotent, safe under concurrent runs, cannot remove a grant. Dry run (apply=false) writes nothing. */
export async function syncFinancePermissions(apply: boolean): Promise<(FinanceSyncPlan & { applied: boolean })[]> {
  const out: (FinanceSyncPlan & { applied: boolean })[] = [];
  for (const key of ROLES) {
    const role = await Role.findOne({ key, isSystem: true }).select("permissions").lean();
    const plan = planFinanceSync(key, role ? [...(role.permissions ?? [])] : null);
    let applied = false;
    if (apply && plan.found && plan.add.length) {
      const res = await Role.updateOne({ key, isSystem: true }, { $addToSet: { permissions: { $each: plan.add } } });
      applied = res.modifiedCount === 1;
    }
    out.push({ ...plan, applied });
  }
  return out;
}
