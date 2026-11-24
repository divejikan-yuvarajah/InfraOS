import { describe, expect, it, vi, beforeEach } from "vitest";

import { logoutWithAuthClient } from "@/lib/auth/client";
import {
  getAuthSnapshot,
  getMemoryAccessToken,
  getMemorySession,
  resetAuthMemoryForTests,
  setAuthenticated,
} from "@/lib/auth/state";
import { WORKSPACE_NAV } from "./workspace-nav";

describe("sidebar logout & RBAC navigation", () => {
  beforeEach(() => {
    resetAuthMemoryForTests();
    vi.restoreAllMocks();
  });

  it("clears in-memory session, access token, and auth snapshot on logoutWithAuthClient", async () => {
    setAuthenticated({
      accessToken: "test-access-token",
      user: {
        id: "u1",
        email: "officer@rda.gov.lk",
        firstName: "Nimal",
        lastName: "Perera",
        displayName: "Nimal Perera",
        roleKey: "AGENCY_OFFICER",
        agencyId: "agency-rda",
        status: "ACTIVE",
      },
    });

    expect(getMemoryAccessToken()).toBe("test-access-token");
    expect(getMemorySession()?.user.roleKey).toBe("AGENCY_OFFICER");
    expect(getAuthSnapshot().authenticated).toBe(true);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    await logoutWithAuthClient();

    expect(getMemoryAccessToken()).toBeNull();
    expect(getMemorySession()).toBeNull();
    expect(getAuthSnapshot().authenticated).toBe(false);
    expect(getAuthSnapshot().phase).toBe("unauthenticated");
  });

  it("enforces role-scoped sidebar navigation so non-admin roles never see admin links", () => {
    const visibleHrefsFor = (role: string) =>
      WORKSPACE_NAV.flatMap((g) =>
        g.items
          .filter((it) => !it.roles || it.roles.includes(role))
          .map((it) => it.href),
      );

    const contractorHrefs = visibleHrefsFor("CONTRACTOR");
    expect(contractorHrefs).not.toContain("/admin/users");
    expect(contractorHrefs).not.toContain("/admin/agencies");
    expect(contractorHrefs).not.toContain("/admin/roles");
    expect(contractorHrefs).not.toContain("/inspections");

    const inspectorHrefs = visibleHrefsFor("INSPECTOR");
    expect(inspectorHrefs).toContain("/inspections");
    expect(inspectorHrefs).not.toContain("/admin/users");
    expect(inspectorHrefs).not.toContain("/admin/roles");

    const superAdminHrefs = visibleHrefsFor("SUPER_ADMIN");
    expect(superAdminHrefs).toContain("/admin/users");
    expect(superAdminHrefs).toContain("/admin/agencies");
    expect(superAdminHrefs).toContain("/admin/roles");
  });
});
