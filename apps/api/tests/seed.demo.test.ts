import { SYSTEM_ROLE_KEYS } from "@infraos/shared-types";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import { EnvValidationError } from "../src/config/env.js";
import { seedCoreIdentity } from "../src/database/seeds/core/identity.js";
import { seedDemoData } from "../src/database/seeds/demo/seed-demo.js";
import { resetDemoData } from "../src/database/seeds/demo/reset-demo.js";
import { verifyDemoSeed } from "../src/database/seeds/demo/verify-demo.js";
import {
  assertDemoSeedEnvironment,
} from "../src/database/seeds/helpers/seed-guard.js";
import { DEMO_PROJECT_CODES } from "../src/database/seeds/demo/catalog.js";
import {
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

const TEST_SEED_ENV = {
  NODE_ENV: "test" as const,
  MONGODB_DB_NAME: "infraos_test",
};

describe("demo seed architecture", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
    await Promise.all([
      Role.syncIndexes(),
      Agency.syncIndexes(),
      Project.syncIndexes(),
      WorkRequest.syncIndexes(),
      User.syncIndexes(),
    ]);
  });

  afterEach(async () => {
    try {
      await resetDemoData(TEST_SEED_ENV);
    } catch {
      // collection may be empty on guard tests
    }
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("refuses production and non-approved database targets", () => {
    expect(() =>
      assertDemoSeedEnvironment({
        NODE_ENV: "production",
        MONGODB_DB_NAME: "infraos_test",
      }),
    ).toThrow(EnvValidationError);

    expect(() =>
      assertDemoSeedEnvironment({
        NODE_ENV: "development",
        MONGODB_DB_NAME: "infraos_prod",
      }),
    ).toThrow(EnvValidationError);

    expect(() =>
      assertDemoSeedEnvironment({
        NODE_ENV: "development",
        MONGODB_DB_NAME: "my_shared_db",
      }),
    ).toThrow(EnvValidationError);
  });

  it("seeds demo data idempotently and verifies spatial scenario", async () => {
    await seedDemoData(TEST_SEED_ENV);
    const firstProjects = await Project.countDocuments({
      projectCode: { $in: [...DEMO_PROJECT_CODES] },
    });
    await seedDemoData(TEST_SEED_ENV);
    const secondProjects = await Project.countDocuments({
      projectCode: { $in: [...DEMO_PROJECT_CODES] },
    });
    expect(firstProjects).toBe(DEMO_PROJECT_CODES.length);
    expect(secondProjects).toBe(firstProjects);

    const verification = await verifyDemoSeed();
    expect(verification.pass).toBe(true);

    expect(await Role.countDocuments()).toBe(SYSTEM_ROLE_KEYS.length);
  });

  it("reset removes demo layer but preserves core roles", async () => {
    await seedDemoData(TEST_SEED_ENV);
    await resetDemoData(TEST_SEED_ENV);

    expect(await Project.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(0);
    expect(await Role.countDocuments()).toBe(SYSTEM_ROLE_KEYS.length);
    expect(await Agency.countDocuments()).toBeGreaterThanOrEqual(4);
  });

  it("detects missing demo relations after partial reset", async () => {
    await seedDemoData(TEST_SEED_ENV);
    await Project.deleteMany({});
    const verification = await verifyDemoSeed();
    expect(verification.pass).toBe(false);
    expect(verification.lines.find((l) => l.name === "Projects")?.pass).toBe(
      false,
    );
  });

  it("allows core seed on test database without demo guard", async () => {
    const result = await seedCoreIdentity(TEST_SEED_ENV);
    expect(result.roles).toBe(SYSTEM_ROLE_KEYS.length);
  });
});
