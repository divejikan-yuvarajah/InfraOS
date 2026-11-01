import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Permission, SystemRoleKey } from "@infraos/shared-types";

import { grantCeiling } from "../src/modules/identity/admin-roles/admin-role.policy.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { planSuperAdminSync, syncSuperAdminPermissions } from "../src/modules/identity/seed/sync-super-admin-permissions.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const KEYS = Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[];
/** The pre-redesign Super Admin set, before operational management grants existed. */
const LEGACY = new Set<string>(["project.create", "project.update", "project.submit", "project.approve", "project.hold", "project.cancel", "project.complete", "milestone.create", "milestone.update", "roadsync.work_request.create", "roadsync.work_request.update"]);
const CUSTOM = "citizen_issue.create" as Permission;

async function seed(superPermissions: readonly string[]) {
  for (const key of KEYS) {
    await Role.create({
      key,
      name: SYSTEM_ROLE_META[key].name,
      description: SYSTEM_ROLE_META[key].description,
      permissions: key === "SUPER_ADMIN" ? [...superPermissions] : [...SYSTEM_ROLE_PERMISSIONS[key]],
      scopeType: SYSTEM_ROLE_META[key].scopeType,
      isSystem: true,
      isActive: true,
    });
  }
}

async function others(): Promise<Record<string, string[]>> {
  const roles = await Role.find({ key: { $ne: "SUPER_ADMIN" } }).select("key permissions").lean();
  return Object.fromEntries(roles.map((role) => [role.key, [...role.permissions]]));
}

describe("super admin permission sync", () => {
  beforeAll(async () => {
    await startIsolatedMongo();
  });
  beforeEach(async () => {
    await clearCoreCollections();
  });
  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("dry run reports additive changes and writes nothing", async () => {
    const legacy = SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN.filter((permission) => !LEGACY.has(permission));
    await seed(legacy);
    const result = await syncSuperAdminPermissions(false);
    expect(result.found).toBe(true);
    expect(result.applied).toBe(false);
    expect([...result.add].sort()).toEqual([...LEGACY].sort());
    expect((await Role.findOne({ key: "SUPER_ADMIN" }))?.permissions).toHaveLength(legacy.length);
  });

  it("applies idempotently, keeps customizations, and changes no other role", async () => {
    const legacy = [...SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN.filter((permission) => !LEGACY.has(permission)), CUSTOM];
    await seed(legacy);
    const before = await others();

    const first = await syncSuperAdminPermissions(true);
    expect(first.applied).toBe(true);
    const stored = (await Role.findOne({ key: "SUPER_ADMIN" }))?.permissions ?? [];
    expect(stored).toEqual(expect.arrayContaining([...SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN, CUSTOM]));
    expect(new Set(stored).size).toBe(stored.length);
    expect(first.aboveCeiling).toEqual([CUSTOM]);
    expect(await others()).toEqual(before);

    const second = await syncSuperAdminPermissions(true);
    expect(second.add).toEqual([]);
    expect(second.applied).toBe(false);
    expect((await Role.findOne({ key: "SUPER_ADMIN" }))?.permissions).toHaveLength(stored.length);
    expect(await Role.countDocuments({ key: "SUPER_ADMIN" })).toBe(1);
  });

  it("never grants blocked permissions and does not create a missing role", async () => {
    const ceiling = grantCeiling("SUPER_ADMIN");
    for (const blocked of ["inspection.verify", "inspection.reject", "inspection.submit", "progress.submit", "finance.payment.approve", "roadsync.conflict.resolve"]) {
      expect(SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN).not.toContain(blocked);
      expect(ceiling.has(blocked)).toBe(false);
    }
    expect(planSuperAdminSync(null)).toEqual({ found: false, add: [], aboveCeiling: [], unchangedCount: 0 });
    const missing = await syncSuperAdminPermissions(true);
    expect(missing.found).toBe(false);
    expect(await Role.countDocuments({})).toBe(0);
  });
});
