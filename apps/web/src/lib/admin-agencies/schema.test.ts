import { describe, expect, it } from "vitest";

import { getAgencyCopy } from "./messages";
import { agencyCreateFormSchema, agencyManageIsPlatformHint } from "./schema";

describe("agency management form", () => {
  it("accepts unicode names and rejects operators", () => {
    const parsed = agencyCreateFormSchema.parse({
      code: "rda_west",
      name: "බස්නාහිර පාර",
      type: "DEPARTMENT",
      parentAgencyId: "64b000000000000000000001",
    });
    expect(parsed.name).toBe("බස්නාහිර පාර");
    expect(
      agencyCreateFormSchema.safeParse({
        code: "RDA",
        name: "Road",
        type: "DEPARTMENT",
        parentAgencyId: "",
        $set: { status: "INACTIVE" },
      }).success,
    ).toBe(false);
  });

  it("treats manage as a display hint and keeps three locales", () => {
    expect(agencyManageIsPlatformHint("SUPER_ADMIN")).toBe(true);
    expect(agencyManageIsPlatformHint("GOV_ADMIN")).toBe(false);
    expect(getAgencyCopy("si").title).not.toBe(getAgencyCopy("en").title);
    expect(getAgencyCopy("ta").deactivate).not.toBe(getAgencyCopy("en").deactivate);
  });
});
