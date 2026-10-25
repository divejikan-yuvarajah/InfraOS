import { describe, expect, it } from "vitest";

import { getAdminUsersCopy } from "./messages";
import { adminDirectoryIsStaffHint, adminUserCreateFormSchema } from "./schema";

describe("admin user form", () => {
  it("accepts a subordinate staff draft and rejects privilege fields", () => {
    const parsed = adminUserCreateFormSchema.parse({
      firstName: "නිමල්",
      lastName: "Perera",
      email: "staff@example.com",
      password: "correct-horse",
      roleKey: "AGENCY_OFFICER",
      agencyCode: "RDA_WEST",
    });
    expect(parsed.firstName).toBe("නිමල්");
    expect(
      adminUserCreateFormSchema.safeParse({
        firstName: "A",
        lastName: "B",
        email: "a@example.com",
        password: "correct-horse",
        roleKey: "SUPER_ADMIN",
        agencyCode: "RDA",
      }).success,
    ).toBe(false);
    expect(
      adminUserCreateFormSchema.safeParse({
        firstName: "A",
        lastName: "B",
        email: "a@example.com",
        password: "correct-horse",
        roleKey: "AGENCY_OFFICER",
        agencyCode: "RDA",
        permissions: ["user.create"],
      }).success,
    ).toBe(false);
  });

  it("keeps directory hints out of authorization and has three locales", () => {
    expect(adminDirectoryIsStaffHint("AGENCY_OFFICER")).toBe(true);
    expect(adminDirectoryIsStaffHint("CITIZEN")).toBe(false);
    expect(getAdminUsersCopy("en").activationBlocked).toMatch(/unavailable/i);
    expect(getAdminUsersCopy("si").title).not.toBe(getAdminUsersCopy("en").title);
    expect(getAdminUsersCopy("ta").title).not.toBe(getAdminUsersCopy("en").title);
  });
});
