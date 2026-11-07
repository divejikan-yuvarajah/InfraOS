import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG as PERMISSIONS } from "@infraos/shared-types";

import { grantCeiling } from "../src/modules/identity/admin-roles/admin-role.policy.js";
import { FINANCE_BATCH05_PERMISSIONS, planFinanceSync } from "../src/modules/identity/seed/sync-finance-permissions.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";

const fin = (role: keyof typeof SYSTEM_ROLE_PERMISSIONS) => SYSTEM_ROLE_PERMISSIONS[role].filter((p) => p.startsWith("finance.")).sort();

describe("finance permission matrix (Batch 05)", () => {
  it("catalog contains the new permissions and every seed grant is in the catalog", () => {
    for (const p of FINANCE_BATCH05_PERMISSIONS) expect(PERMISSIONS).toContain(p);
    for (const role of Object.keys(SYSTEM_ROLE_PERMISSIONS) as (keyof typeof SYSTEM_ROLE_PERMISSIONS)[]) for (const p of SYSTEM_ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
  });
  it("grants exactly the approved matrix", () => {
    expect(fin("GOV_ADMIN")).toEqual(["finance.budget.approve", "finance.budget.read", "finance.budget.update", "finance.expense.create", "finance.expense.read", "finance.expense.verify", "finance.payment.approve", "finance.payment.create", "finance.payment.read", "finance.payment.reject", "finance.payment.update", "finance.report.export"]);
    expect(fin("AGENCY_OFFICER")).toEqual(["finance.budget.read", "finance.budget.update", "finance.expense.create", "finance.expense.read", "finance.expense.verify", "finance.payment.create", "finance.payment.read", "finance.payment.update", "finance.report.export"]);
    expect(fin("PROJECT_MANAGER")).toEqual(["finance.budget.read", "finance.budget.update", "finance.expense.create", "finance.expense.read", "finance.payment.create", "finance.payment.read", "finance.payment.update", "finance.report.export"]);
    expect(fin("SUPER_ADMIN")).toEqual(["finance.budget.read", "finance.expense.read", "finance.payment.read", "finance.report.export"]);
    for (const r of ["CONTRACTOR", "INSPECTOR", "CITIZEN"] as const) expect(fin(r)).toEqual([]);
  });
  it("SUPER_ADMIN stays read-only and approvers are inside the policy ceiling", () => {
    const sa = grantCeiling("SUPER_ADMIN");
    for (const p of ["finance.budget.approve", "finance.expense.create", "finance.expense.verify", "finance.payment.approve"]) expect(sa.has(p)).toBe(false);
    expect(grantCeiling("GOV_ADMIN").has("finance.budget.approve")).toBe(true);
    expect(grantCeiling("AGENCY_OFFICER").has("finance.budget.approve")).toBe(false);
    expect(grantCeiling("PROJECT_MANAGER").has("finance.expense.verify")).toBe(false);
  });
  it("sync plan is additive, idempotent and limited to the new grants", () => {
    const old = SYSTEM_ROLE_PERMISSIONS.GOV_ADMIN.filter((p) => !FINANCE_BATCH05_PERMISSIONS.includes(p as never));
    expect(planFinanceSync("GOV_ADMIN", old).add.sort()).toEqual([...FINANCE_BATCH05_PERMISSIONS].sort());
    expect(planFinanceSync("GOV_ADMIN", [...old, ...FINANCE_BATCH05_PERMISSIONS]).add).toEqual([]);
    expect(planFinanceSync("PROJECT_MANAGER", ["project.read"]).add.sort()).toEqual(["finance.expense.create", "finance.expense.read"]);
    expect(planFinanceSync("CONTRACTOR" as never, null)).toEqual({ role: "CONTRACTOR", found: false, add: [] });
  });
});
