import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG } from "@infraos/shared-types";

import { grantCeiling } from "../src/modules/identity/admin-roles/admin-role.policy.js";
import { COPILOT_BATCH12_GRANTS, planCopilotSync } from "../src/modules/identity/seed/sync-copilot-permissions.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";

const hasCopilot = (role: keyof typeof SYSTEM_ROLE_PERMISSIONS) =>
  SYSTEM_ROLE_PERMISSIONS[role].includes("copilot.use");

describe("Copilot permission matrix (Phase 10 Batch 12)", () => {
  it("grants copilot.use only to SUPER_ADMIN, GOV_ADMIN, AGENCY_OFFICER, PROJECT_MANAGER, INSPECTOR", () => {
    expect(PERMISSION_CATALOG).toContain("copilot.use");

    expect(hasCopilot("SUPER_ADMIN")).toBe(true);
    expect(hasCopilot("GOV_ADMIN")).toBe(true);
    expect(hasCopilot("AGENCY_OFFICER")).toBe(true);
    expect(hasCopilot("PROJECT_MANAGER")).toBe(true);
    expect(hasCopilot("INSPECTOR")).toBe(true);

    // CONTRACTOR and CITIZEN never hold copilot.use
    expect(hasCopilot("CONTRACTOR")).toBe(false);
    expect(hasCopilot("CITIZEN")).toBe(false);
  });

  it("sync plan is additive, idempotent and inside the policy ceiling", () => {
    expect(COPILOT_BATCH12_GRANTS.SUPER_ADMIN).toEqual(["copilot.use"]);
    expect(COPILOT_BATCH12_GRANTS.GOV_ADMIN).toEqual(["copilot.use"]);
    expect(COPILOT_BATCH12_GRANTS.AGENCY_OFFICER).toEqual(["copilot.use"]);
    expect(COPILOT_BATCH12_GRANTS.PROJECT_MANAGER).toEqual(["copilot.use"]);
    expect(COPILOT_BATCH12_GRANTS.INSPECTOR).toEqual(["copilot.use"]);

    const old = SYSTEM_ROLE_PERMISSIONS.INSPECTOR.filter((p) => p !== "copilot.use");
    expect(planCopilotSync("INSPECTOR", old).add).toEqual(["copilot.use"]);
    expect(planCopilotSync("INSPECTOR", [...old, "copilot.use"]).add).toEqual([]);
    expect(planCopilotSync("GOV_ADMIN", null)).toEqual({ role: "GOV_ADMIN", found: false, add: [] });

    expect(grantCeiling("SUPER_ADMIN").has("copilot.use")).toBe(true);
    expect(grantCeiling("GOV_ADMIN").has("copilot.use")).toBe(true);
    expect(grantCeiling("AGENCY_OFFICER").has("copilot.use")).toBe(true);
    expect(grantCeiling("PROJECT_MANAGER").has("copilot.use")).toBe(true);
    expect(grantCeiling("INSPECTOR").has("copilot.use")).toBe(true);

    expect(grantCeiling("CONTRACTOR").has("copilot.use")).toBe(false);
    expect(grantCeiling("CITIZEN").has("copilot.use")).toBe(false);
  });
});
