import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG } from "@infraos/shared-types";

import { grantCeiling } from "../src/modules/identity/admin-roles/admin-role.policy.js";
import { DOCUMENT_BATCH08_GRANTS, planDocumentSync } from "../src/modules/identity/seed/sync-document-permissions.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";

const sel = (role: keyof typeof SYSTEM_ROLE_PERMISSIONS) => SYSTEM_ROLE_PERMISSIONS[role].filter((p) => /^document\./.test(p)).sort();

describe("DocTrace permission matrix (Batch 08)", () => {
  it("grants exactly the approved matrix; contractors and citizens never gain read", () => {
    expect(PERMISSION_CATALOG).toContain("document.update");
    expect(PERMISSION_CATALOG).toContain("document.restrict");
    expect(sel("GOV_ADMIN")).toEqual(["document.ask", "document.delete", "document.download", "document.process", "document.read", "document.restrict", "document.update", "document.upload"]);
    expect(sel("AGENCY_OFFICER")).toEqual(["document.ask", "document.download", "document.process", "document.read", "document.restrict", "document.update", "document.upload"]);
    expect(sel("PROJECT_MANAGER")).toEqual(["document.ask", "document.download", "document.process", "document.read", "document.update", "document.upload"]);
    for (const r of ["SUPER_ADMIN", "INSPECTOR", "CONTRACTOR"] as const) expect(sel(r)).not.toContain("document.update");
    for (const r of Object.keys(SYSTEM_ROLE_PERMISSIONS) as (keyof typeof SYSTEM_ROLE_PERMISSIONS)[]) expect(SYSTEM_ROLE_PERMISSIONS[r].includes("document.restrict")).toBe(r === "GOV_ADMIN" || r === "AGENCY_OFFICER");
    expect(sel("CITIZEN")).not.toContain("document.read");
  });
  it("sync plan is additive, idempotent and inside the policy ceiling", () => {
    const old = SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER.filter((p) => !DOCUMENT_BATCH08_GRANTS.AGENCY_OFFICER!.includes(p));
    expect(planDocumentSync("AGENCY_OFFICER", old).add.sort()).toEqual(["document.restrict", "document.update"]);
    expect(planDocumentSync("AGENCY_OFFICER", [...old, "document.update", "document.restrict"]).add).toEqual([]);
    expect(planDocumentSync("GOV_ADMIN", null)).toEqual({ role: "GOV_ADMIN", found: false, add: [] });
    expect(grantCeiling("PROJECT_MANAGER").has("document.restrict")).toBe(false);
  });
});

describe("ai.manage permission (Batch 09)", () => {
  it("is held only by GOV_ADMIN and SUPER_ADMIN and is inside their grant ceiling", () => {
    expect(PERMISSION_CATALOG).toContain("ai.manage");
    for (const r of Object.keys(SYSTEM_ROLE_PERMISSIONS) as (keyof typeof SYSTEM_ROLE_PERMISSIONS)[]) {
      expect(SYSTEM_ROLE_PERMISSIONS[r].includes("ai.manage")).toBe(r === "GOV_ADMIN" || r === "SUPER_ADMIN");
    }
    expect(grantCeiling("GOV_ADMIN").has("ai.manage")).toBe(true);
    expect(grantCeiling("SUPER_ADMIN").has("ai.manage")).toBe(true);
  });
  it("sync plan adds ai.manage additively and is idempotent", () => {
    const old = SYSTEM_ROLE_PERMISSIONS.GOV_ADMIN.filter((p) => p !== "ai.manage");
    expect(planDocumentSync("GOV_ADMIN", old).add).toEqual(["ai.manage"]);
    expect(planDocumentSync("GOV_ADMIN", [...old, "ai.manage"]).add).toEqual([]);
    expect(planDocumentSync("SUPER_ADMIN", SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN.filter((p) => p !== "ai.manage")).add).toEqual(["ai.manage"]);
  });
});
