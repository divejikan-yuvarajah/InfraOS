import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG as PERMISSIONS } from "@infraos/shared-types";

import { grantCeiling } from "../src/modules/identity/admin-roles/admin-role.policy.js";
import { INSPECTION_BATCH06_PERMISSIONS, planInspectionSync } from "../src/modules/identity/seed/sync-inspection-permissions.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";

const ins = (role: keyof typeof SYSTEM_ROLE_PERMISSIONS) => SYSTEM_ROLE_PERMISSIONS[role].filter((p) => p.startsWith("inspection.")).sort();

describe("inspection permission matrix (Batch 06)", () => {
  it("grants exactly the approved matrix", () => {
    expect(ins("GOV_ADMIN")).toEqual(["inspection.assign", "inspection.read", "inspection.reject", "inspection.verify"]);
    expect(ins("AGENCY_OFFICER")).toEqual(["inspection.assign", "inspection.read", "inspection.reject", "inspection.verify"]);
    expect(ins("PROJECT_MANAGER")).toEqual(["inspection.assign", "inspection.read"]);
    expect(ins("INSPECTOR")).toEqual(["inspection.read", "inspection.reject", "inspection.submit", "inspection.verify"]);
    expect(ins("SUPER_ADMIN")).toEqual(["inspection.read"]);
    for (const r of ["CONTRACTOR", "CITIZEN"] as const) expect(ins(r)).toEqual([]);
  });
  it("catalog has the grants; super admin and project manager ceilings stay closed", () => {
    for (const p of INSPECTION_BATCH06_PERMISSIONS) expect(PERMISSIONS).toContain(p);
    for (const p of ["inspection.verify", "inspection.reject", "inspection.submit"]) expect(grantCeiling("SUPER_ADMIN").has(p)).toBe(false);
    expect(grantCeiling("PROJECT_MANAGER").has("inspection.verify")).toBe(false);
    expect(grantCeiling("GOV_ADMIN").has("inspection.verify")).toBe(true);
    expect(grantCeiling("AGENCY_OFFICER").has("inspection.reject")).toBe(true);
  });
  it("sync plan is additive, idempotent and limited to the reviewer grants", () => {
    const old = SYSTEM_ROLE_PERMISSIONS.GOV_ADMIN.filter((p) => !INSPECTION_BATCH06_PERMISSIONS.includes(p as never));
    expect(planInspectionSync("GOV_ADMIN", old).add.sort()).toEqual([...INSPECTION_BATCH06_PERMISSIONS].sort());
    expect(planInspectionSync("AGENCY_OFFICER", [...old, ...INSPECTION_BATCH06_PERMISSIONS]).add).toEqual([]);
    expect(planInspectionSync("GOV_ADMIN", null)).toEqual({ role: "GOV_ADMIN", found: false, add: [] });
  });
});
