import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG } from "@infraos/shared-types";

import { grantCeiling } from "../src/modules/identity/admin-roles/admin-role.policy.js";
import { RISK_BATCH11_GRANTS, planRiskSync } from "../src/modules/identity/seed/sync-risk-permissions.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";

const sel = (role: keyof typeof SYSTEM_ROLE_PERMISSIONS) =>
  SYSTEM_ROLE_PERMISSIONS[role].filter((p) => /^risk\./.test(p)).sort();

describe("Risk Intelligence permission matrix (Batch 11)", () => {
  it("grants risk.resolve only to GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER", () => {
    expect(PERMISSION_CATALOG).toContain("risk.request");
    expect(PERMISSION_CATALOG).toContain("risk.read");
    expect(PERMISSION_CATALOG).toContain("risk.resolve");

    expect(sel("GOV_ADMIN")).toEqual(["risk.read", "risk.request", "risk.resolve"]);
    expect(sel("AGENCY_OFFICER")).toEqual(["risk.read", "risk.request", "risk.resolve"]);
    expect(sel("PROJECT_MANAGER")).toEqual(["risk.read", "risk.request", "risk.resolve"]);

    // SUPER_ADMIN has platform read and request, but not operational project-level resolve
    expect(sel("SUPER_ADMIN")).toEqual(["risk.read", "risk.request"]);

    // CONTRACTOR, INSPECTOR, CITIZEN never hold risk permissions
    expect(sel("CONTRACTOR")).toEqual([]);
    expect(sel("INSPECTOR")).toEqual([]);
    expect(sel("CITIZEN")).toEqual([]);
  });

  it("sync plan is additive, idempotent and inside the policy ceiling", () => {
    expect(RISK_BATCH11_GRANTS.GOV_ADMIN).toEqual(["risk.resolve"]);
    const old = SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER.filter((p) => p !== "risk.resolve");
    expect(planRiskSync("AGENCY_OFFICER", old).add).toEqual(["risk.resolve"]);
    expect(planRiskSync("AGENCY_OFFICER", [...old, "risk.resolve"]).add).toEqual([]);
    expect(planRiskSync("GOV_ADMIN", null)).toEqual({ role: "GOV_ADMIN", found: false, add: [] });
    expect(grantCeiling("SUPER_ADMIN").has("risk.resolve")).toBe(false);
    expect(grantCeiling("CONTRACTOR").has("risk.resolve")).toBe(false);
    expect(grantCeiling("INSPECTOR").has("risk.resolve")).toBe(false);
    expect(grantCeiling("CITIZEN").has("risk.resolve")).toBe(false);
  });
});
