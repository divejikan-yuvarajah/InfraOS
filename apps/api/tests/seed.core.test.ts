import { SYSTEM_ROLE_KEYS } from "@infraos/shared-types";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { seedCoreIdentity } from "../src/scripts/seed-core.js";
import {
  clearCoreCollections,
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

describe("core seed", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
  });

  afterEach(async () => {
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("upserts seven system roles and demo agencies without users", async () => {
    await seedCoreIdentity();
    await seedCoreIdentity();

    expect(await Role.countDocuments()).toBe(SYSTEM_ROLE_KEYS.length);
    expect(await Agency.countDocuments()).toBe(4);
    expect(await User.countDocuments()).toBe(0);

    const sa = await Role.findOne({ key: "SUPER_ADMIN" });
    expect(sa?.isSystem).toBe(true);
    expect(sa?.permissions).not.toContain("project.approve");
    expect(sa?.permissions).not.toContain("finance.payment.approve");
    expect(sa?.permissions).not.toContain("inspection.verify");
    expect(sa?.permissions).not.toContain("roadsync.conflict.resolve");

    const rda = await Agency.findOne({ code: "DEMO_RDA" }).populate(
      "parentAgencyId",
    );
    expect(rda?.name).toMatch(/Demo/);
    expect((rda?.parentAgencyId as { code?: string } | null)?.code).toBe(
      "DEMO_MINISTRY",
    );
  });
});
