import type { SystemRoleKey } from "@infraos/shared-types";

import { grantCeiling } from "../admin-roles/admin-role.policy.js";
import { Role } from "../models/role.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "./system-role-permissions.js";

/** The Batch 08 DocTrace grants (document.update, document.restrict). Only these are ever added, so other customizations on stored roles are never touched. */
export const DOCUMENT_BATCH08_GRANTS: Partial<Record<SystemRoleKey, readonly string[]>> = {
  GOV_ADMIN: ["document.update", "document.restrict"],
  AGENCY_OFFICER: ["document.update", "document.restrict"],
  PROJECT_MANAGER: ["document.update"],
};
const ROLES = Object.keys(DOCUMENT_BATCH08_GRANTS) as SystemRoleKey[];

export type DocumentSyncPlan = { role: SystemRoleKey; found: boolean; add: string[] };

/** Pure planner: additive only, limited to canonical Batch 08 grants inside each role's policy ceiling. */
export function planDocumentSync(role: SystemRoleKey, current: readonly string[] | null): DocumentSyncPlan {
  if (!current) return { role, found: false, add: [] };
  const have = new Set(current);
  const ceiling = grantCeiling(role);
  const canonical = new Set<string>(SYSTEM_ROLE_PERMISSIONS[role]);
  return { role, found: true, add: (DOCUMENT_BATCH08_GRANTS[role] ?? []).filter((p) => canonical.has(p) && ceiling.has(p) && !have.has(p)) };
}

/** $addToSet per system role: idempotent, safe under concurrent runs, cannot remove a grant. Dry run (apply=false) writes nothing. */
export async function syncDocumentPermissions(apply: boolean): Promise<(DocumentSyncPlan & { applied: boolean })[]> {
  const out: (DocumentSyncPlan & { applied: boolean })[] = [];
  for (const key of ROLES) {
    const role = await Role.findOne({ key, isSystem: true }).select("permissions").lean();
    const plan = planDocumentSync(key, role ? [...(role.permissions ?? [])] : null);
    let applied = false;
    if (apply && plan.found && plan.add.length) {
      const res = await Role.updateOne({ key, isSystem: true }, { $addToSet: { permissions: { $each: plan.add } } });
      applied = res.modifiedCount === 1;
    }
    out.push({ ...plan, applied });
  }
  return out;
}
