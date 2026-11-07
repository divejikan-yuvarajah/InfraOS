import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG as PERMISSIONS } from "@infraos/shared-types";

import { grantCeiling } from "../src/modules/identity/admin-roles/admin-role.policy.js";
import { ASSET_BATCH07_GRANTS, planAssetSync } from "../src/modules/identity/seed/sync-asset-permissions.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";

const sel = (role: keyof typeof SYSTEM_ROLE_PERMISSIONS) => SYSTEM_ROLE_PERMISSIONS[role].filter((p) => /^(asset|maintenance)\./.test(p)).sort();

describe("asset lifecycle permission matrix (Batch 07)", () => {
  it("grants exactly the approved matrix", () => {
    expect(sel("GOV_ADMIN")).toEqual(["asset.conversion.approve", "asset.create", "asset.health.read", "asset.read", "asset.update", "maintenance.create", "maintenance.update"]);
    expect(sel("SUPER_ADMIN")).toEqual(["asset.create", "asset.health.read", "asset.read", "asset.update", "maintenance.create", "maintenance.update"]);
    expect(sel("AGENCY_OFFICER")).toEqual(["asset.create", "asset.health.read", "asset.read", "asset.update", "maintenance.create", "maintenance.update"]);
    expect(sel("PROJECT_MANAGER")).toEqual(["asset.create", "asset.health.read", "asset.read", "maintenance.create"]);
    expect(sel("INSPECTOR")).toEqual(["asset.read"]);
    for (const r of ["CONTRACTOR", "CITIZEN"] as const) expect(sel(r)).toEqual([]);
  });
  it("only GOV_ADMIN may approve conversions; the catalog contains the new grant", () => {
    expect(PERMISSIONS).toContain("asset.conversion.approve");
    for (const r of Object.keys(SYSTEM_ROLE_PERMISSIONS) as (keyof typeof SYSTEM_ROLE_PERMISSIONS)[]) expect(SYSTEM_ROLE_PERMISSIONS[r].includes("asset.conversion.approve")).toBe(r === "GOV_ADMIN");
    expect(grantCeiling("PROJECT_MANAGER").has("maintenance.update")).toBe(false);
  });
  it("sync plan is additive, idempotent and limited to the new grants", () => {
    const old = SYSTEM_ROLE_PERMISSIONS.PROJECT_MANAGER.filter((p) => !ASSET_BATCH07_GRANTS.PROJECT_MANAGER!.includes(p));
    expect(planAssetSync("PROJECT_MANAGER", old).add.sort()).toEqual(["asset.create", "asset.health.read"]);
    expect(planAssetSync("PROJECT_MANAGER", [...old, "asset.create", "asset.health.read"]).add).toEqual([]);
    expect(planAssetSync("GOV_ADMIN", null)).toEqual({ role: "GOV_ADMIN", found: false, add: [] });
  });
});
