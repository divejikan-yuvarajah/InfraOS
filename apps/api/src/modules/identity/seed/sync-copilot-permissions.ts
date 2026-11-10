import type { SystemRoleKey } from "@infraos/shared-types";

import { grantCeiling } from "../admin-roles/admin-role.policy.js";
import { Role } from "../models/role.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "./system-role-permissions.js";

/**
 * Phase 10 Batch 12 Copilot grants (copilot.use).
 * Granted to SUPER_ADMIN, GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER, INSPECTOR.
 * CONTRACTOR and CITIZEN never hold copilot.use.
 */
export const COPILOT_BATCH12_GRANTS: Partial<Record<SystemRoleKey, readonly string[]>> = {
  SUPER_ADMIN: ["copilot.use"],
  GOV_ADMIN: ["copilot.use"],
  AGENCY_OFFICER: ["copilot.use"],
  PROJECT_MANAGER: ["copilot.use"],
  INSPECTOR: ["copilot.use"],
};

const ROLES = Object.keys(COPILOT_BATCH12_GRANTS) as SystemRoleKey[];

export type CopilotSyncPlan = { role: SystemRoleKey; found: boolean; add: string[] };

/** Pure planner: additive only, limited to canonical Batch 12 grants inside each role's policy ceiling. */
export function planCopilotSync(role: SystemRoleKey, current: readonly string[] | null): CopilotSyncPlan {
  if (!current) return { role, found: false, add: [] };
  const have = new Set(current);
  const ceiling = grantCeiling(role);
  const canonical = new Set<string>(SYSTEM_ROLE_PERMISSIONS[role]);
  return {
    role,
    found: true,
    add: (COPILOT_BATCH12_GRANTS[role] ?? []).filter((p) => canonical.has(p) && ceiling.has(p) && !have.has(p)),
  };
}

/** $addToSet per system role: idempotent, safe under concurrent runs, cannot remove a grant. Dry run (apply=false) writes nothing. */
export async function syncCopilotPermissions(apply: boolean): Promise<(CopilotSyncPlan & { applied: boolean })[]> {
  const out: (CopilotSyncPlan & { applied: boolean })[] = [];
  for (const key of ROLES) {
    const role = await Role.findOne({ key, isSystem: true }).select("permissions").lean();
    const plan = planCopilotSync(key, role ? [...(role.permissions ?? [])] : null);
    let applied = false;
    if (apply && plan.found && plan.add.length) {
      const res = await Role.updateOne({ key, isSystem: true }, { $addToSet: { permissions: { $each: plan.add } } });
      applied = res.modifiedCount === 1;
    }
    out.push({ ...plan, applied });
  }
  return out;
}

