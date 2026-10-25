import type { Permission, SystemRoleKey } from "@infraos/shared-types";

import { SYSTEM_ROLE_PERMISSIONS } from "../seed/system-role-permissions.js";

/**
 * Grants that must never be newly assigned, even if they appear in a seed.
 * agency.manage on GOV_ADMIN is contested with Step 49 (Super Admin writes only).
 */
const BLOCKED: Record<SystemRoleKey, readonly Permission[]> = {
  SUPER_ADMIN: [
    "project.approve",
    "finance.payment.approve",
    "finance.payment.reject",
    "inspection.verify",
    "inspection.reject",
    "roadsync.conflict.resolve",
  ],
  GOV_ADMIN: ["role.manage", "permission.manage", "system.manage", "agency.manage"],
  AGENCY_OFFICER: [
    "role.manage",
    "permission.manage",
    "system.manage",
    "finance.payment.approve",
    "project.approve",
    "inspection.verify",
  ],
  PROJECT_MANAGER: [
    "role.manage",
    "permission.manage",
    "system.manage",
    "finance.payment.approve",
    "project.approve",
    "agency.manage",
    "inspection.verify",
  ],
  CONTRACTOR: [
    "role.manage",
    "permission.manage",
    "system.manage",
    "user.create",
    "user.update",
    "user.disable",
    "agency.manage",
    "finance.payment.approve",
    "project.approve",
    "inspection.verify",
  ],
  INSPECTOR: [
    "role.manage",
    "permission.manage",
    "system.manage",
    "user.create",
    "agency.manage",
    "finance.payment.approve",
    "project.approve",
  ],
  CITIZEN: [
    "role.manage",
    "permission.manage",
    "system.manage",
    "user.read",
    "user.create",
    "agency.manage",
    "finance.payment.approve",
    "project.approve",
    "inspection.verify",
  ],
};

/**
 * Contested seed grants. Present values must be kept; absent values must not be added.
 * Super Admin citizen-issue mutations are operational writes inside the seed and stay
 * frozen until an owner accepts or removes them. They are not purged here.
 */
export const FROZEN_GRANTS: Partial<Record<SystemRoleKey, readonly Permission[]>> = {
  SUPER_ADMIN: ["citizen_issue.assign", "citizen_issue.update", "citizen_issue.close"],
  GOV_ADMIN: ["agency.manage"],
};

export const SUPER_ADMIN_GOVERNANCE: readonly Permission[] = [
  "role.read",
  "role.manage",
  "permission.read",
  "permission.manage",
];

export function grantCeiling(roleKey: SystemRoleKey): ReadonlySet<string> {
  const blocked = new Set<string>(BLOCKED[roleKey]);
  return new Set(SYSTEM_ROLE_PERMISSIONS[roleKey].filter((permission) => !blocked.has(permission)));
}

export type GrantDecision =
  | { ok: true; next: Permission[] }
  | { ok: false; status: 400 | 409; code: "VALIDATION_ERROR" | "CONFLICT" };

export function decideGrantUpdate(
  roleKey: SystemRoleKey,
  current: readonly string[],
  requested: readonly string[],
): GrantDecision {
  const ceiling = grantCeiling(roleKey);
  const frozen = new Set(FROZEN_GRANTS[roleKey] ?? []);
  const next = [...requested] as Permission[];
  for (const permission of next) {
    if (frozen.has(permission)) {
      if (!current.includes(permission)) return { ok: false, status: 409, code: "CONFLICT" };
      continue;
    }
    if (!ceiling.has(permission)) return { ok: false, status: 409, code: "CONFLICT" };
  }
  for (const permission of frozen) {
    if (current.includes(permission) && !next.includes(permission)) {
      return { ok: false, status: 409, code: "CONFLICT" };
    }
  }
  if (roleKey === "SUPER_ADMIN") {
    for (const required of SUPER_ADMIN_GOVERNANCE) {
      if (!next.includes(required)) return { ok: false, status: 409, code: "CONFLICT" };
    }
  }
  return { ok: true, next };
}
