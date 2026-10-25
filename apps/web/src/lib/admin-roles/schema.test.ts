import { describe, expect, it } from "vitest";

import { clearPrivateQueryCache, registerPrivateQueryCache } from "@/lib/auth/query-cache";
import { classifyAppPath } from "@/lib/auth/route-access";

import { getRoleCopy } from "./messages";
import { roleManageIsPlatformHint, roleMetadataFormSchema, rolePermissionsFormSchema } from "./schema";
import { ADMIN_ROLES_QUERY_KEY, bannerFromStatus, grantChangePreview, roleBannerMessage, visibleRoleGrants } from "./view-state";

describe("role administration form", () => {
  it("rejects privilege fields and short reasons", () => {
    expect(roleMetadataFormSchema.safeParse({ name: "Officer", description: "Ops", key: "SUPER_ADMIN" }).success).toBe(false);
    expect(rolePermissionsFormSchema.safeParse({ permissions: ["role.manage"], reason: "short" }).success).toBe(false);
    expect(
      rolePermissionsFormSchema.parse({ permissions: ["profile.read"], reason: "Approved profile read" }).permissions,
    ).toEqual(["profile.read"]);
  });

  it("keeps manage as a display hint and has three locales", () => {
    expect(roleManageIsPlatformHint("SUPER_ADMIN")).toBe(true);
    expect(roleManageIsPlatformHint("GOV_ADMIN")).toBe(false);
    expect(getRoleCopy("si").title).not.toBe(getRoleCopy("en").title);
    expect(getRoleCopy("ta").title).not.toBe(getRoleCopy("en").title);
  });

  it("maps errors and previews grant changes without treating the hint as authority", () => {
    const copy = getRoleCopy("en");
    expect(roleBannerMessage(bannerFromStatus(403), copy)).toBe(copy.forbidden);
    expect(roleBannerMessage(bannerFromStatus(409), copy)).toBe(copy.conflict);
    expect(roleBannerMessage(bannerFromStatus(503), copy)).toBe(copy.unavailable);
    const saved = { id: "role-1", permissions: ["profile.read", "project.read"] };
    expect(visibleRoleGrants(saved, null)).toEqual(["profile.read", "project.read"]);
    expect(visibleRoleGrants(saved, { id: "other", permissions: [] })).toEqual(["profile.read", "project.read"]);
    expect(visibleRoleGrants(saved, { id: "role-1", permissions: ["profile.read"] })).toEqual(["profile.read"]);
    expect(grantChangePreview(["profile.read", "role.read"], ["profile.read", "agency.read"])).toEqual({
      added: ["agency.read"],
      removed: ["role.read"],
    });
    expect(classifyAppPath("/admin/roles")).toBe("private");
    expect(classifyAppPath("/si/admin/roles")).toBe("public");
  });

  it("drops a private role cache when the session cache is cleared", () => {
    const seen = new Set<string>([ADMIN_ROLES_QUERY_KEY.join("/")]);
    const unregister = registerPrivateQueryCache({
      clear: () => seen.clear(),
    });
    clearPrivateQueryCache();
    expect(seen.size).toBe(0);
    unregister();
  });
});
