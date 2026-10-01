import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { mapMongoDuplicateField } from "../src/shared/errors/mongo-duplicate.js";
import {
  clearCoreCollections,
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

describe("agency model", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
    await Agency.syncIndexes();
  });

  afterEach(async () => {
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("uppercases unique codes and accepts optional parent", async () => {
    const ministry = await Agency.create({
      code: "demo_ministry",
      name: "Demo Ministry of Infrastructure",
      type: "MINISTRY",
    });
    expect(ministry.code).toBe("DEMO_MINISTRY");
    expect(ministry.status).toBe("ACTIVE");

    const child = await Agency.create({
      code: "DEMO_RDA",
      name: "Demo Road Development Authority",
      type: "ROAD",
      parentAgencyId: ministry._id,
    });
    expect(child.parentAgencyId?.toString()).toBe(ministry._id.toString());
  });

  it("rejects invalid type/status and self-parent", async () => {
    const agency = await Agency.create({
      code: "DEMO_WATER",
      name: "Demo Water",
      type: "WATER",
    });
    agency.parentAgencyId = agency._id;
    await expect(agency.validate()).rejects.toThrow(/own parent/);

    const invalid = new Agency({
      code: "X",
      name: "X",
      type: "SPACESHIP",
    });
    await expect(invalid.validate()).rejects.toThrow(/type/);
  });

  it("enforces unique agency codes", async () => {
    await Agency.create({
      code: "DEMO_ELEC",
      name: "Demo Electricity",
      type: "ELECTRICITY",
    });
    try {
      await Agency.create({
        code: "demo_elec",
        name: "Duplicate",
        type: "ELECTRICITY",
      });
      throw new Error("expected duplicate");
    } catch (error) {
      expect(mapMongoDuplicateField(error)).toBe("code");
    }
  });
});
