import { Types } from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { mapMongoDuplicateField } from "../src/shared/errors/mongo-duplicate.js";
import {
  clearCoreCollections,
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

const HASH = "x".repeat(60);

describe("identity models", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
    await Role.syncIndexes();
    await User.syncIndexes();
    await RefreshSession.syncIndexes();
  });

  afterEach(async () => {
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("normalizes email and requires a role reference", async () => {
    const role = await Role.create({
      key: "CITIZEN",
      name: "Citizen",
      description: "test",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.CITIZEN],
      scopeType: "PUBLIC",
    });

    const user = await User.create({
      firstName: "Amal",
      lastName: "Perera",
      email: "  AMAL.PERERA@EXAMPLE.COM ",
      passwordHash: HASH,
      roleId: role._id,
    });

    expect(user.email).toBe("amal.perera@example.com");
    expect(user.status).toBe("PENDING");
    expect(user.displayName).toBe("Amal Perera");
    expect(user.agencyId).toBeNull();
  });

  it("rejects invalid status and missing email", async () => {
    const role = await Role.create({
      key: "INSPECTOR",
      name: "Inspector",
      description: "test",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.INSPECTOR],
      scopeType: "ASSIGNED_INSPECTION",
    });

    await expect(
      User.create({
        firstName: "A",
        lastName: "B",
        passwordHash: HASH,
        roleId: role._id,
      }),
    ).rejects.toThrow();

    const user = new User({
      firstName: "A",
      lastName: "B",
      email: "a@example.com",
      passwordHash: HASH,
      roleId: role._id,
      status: "BANNED",
    });
    await expect(user.validate()).rejects.toThrow(/status/);
  });

  it("excludes passwordHash from default queries and JSON", async () => {
    const role = await Role.create({
      key: "CONTRACTOR",
      name: "Contractor",
      description: "test",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.CONTRACTOR],
      scopeType: "ASSIGNED_PROJECT",
    });

    const created = await User.create({
      firstName: "Nimal",
      lastName: "Silva",
      email: "nimal@example.com",
      passwordHash: HASH,
      roleId: role._id,
    });

    const found = await User.findById(created._id);
    expect(found?.passwordHash).toBeUndefined();
    expect(found?.toJSON()).not.toHaveProperty("passwordHash");

    const withHash = await User.findById(created._id).select("+passwordHash");
    expect(withHash?.passwordHash).toBe(HASH);
    expect(withHash?.toObject()).not.toHaveProperty("passwordHash");

    const leanDefault = await User.findById(created._id).lean();
    expect(leanDefault).not.toHaveProperty("passwordHash");
    const leanSelected = await User.findById(created._id).select("+passwordHash").lean();
    expect(leanSelected).toHaveProperty("passwordHash", HASH);
  });

  it("enforces unique normalized emails", async () => {
    const role = await Role.create({
      key: "AGENCY_OFFICER",
      name: "Agency Officer",
      description: "test",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
      scopeType: "AGENCY",
    });

    await User.create({
      firstName: "One",
      lastName: "User",
      email: "dup@example.com",
      passwordHash: HASH,
      roleId: role._id,
    });

    try {
      await User.create({
        firstName: "Two",
        lastName: "User",
        email: "DUP@example.com",
        passwordHash: HASH,
        roleId: role._id,
      });
      throw new Error("expected duplicate");
    } catch (error) {
      expect(mapMongoDuplicateField(error)).toBe("email");
    }
  });

  it("rejects unknown or duplicate role permissions", async () => {
    await expect(
      Role.create({
        key: "SUPER_ADMIN",
        name: "SA",
        description: "test",
        permissions: ["project.read", "not.a.permission"],
        scopeType: "PLATFORM",
      }),
    ).rejects.toThrow(/permissions/);

    await expect(
      Role.create({
        key: "GOV_ADMIN",
        name: "GA",
        description: "test",
        permissions: ["project.read", "project.read"],
        scopeType: "ORGANIZATION",
      }),
    ).rejects.toThrow(/permissions/);
  });

  it("requires a unique system role key and valid scope", async () => {
    await Role.create({
      key: "PROJECT_MANAGER",
      name: "PM",
      description: "test",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.PROJECT_MANAGER],
      scopeType: "ASSIGNED_PROJECT",
    });

    await expect(
      Role.create({
        key: "PROJECT_MANAGER",
        name: "PM2",
        description: "test",
        permissions: [...SYSTEM_ROLE_PERMISSIONS.PROJECT_MANAGER],
        scopeType: "ASSIGNED_PROJECT",
      }),
    ).rejects.toThrow();

    const invalid = new Role({
      key: "SUPER_ADMIN",
      name: "SA",
      description: "test",
      permissions: ["audit.read"],
      scopeType: "GALAXY",
    });
    await expect(invalid.validate()).rejects.toThrow(/scopeType/);
  });

  it("stores hashed refresh sessions with a TTL index", async () => {
    const role = await Role.create({
      key: "CITIZEN",
      name: "Citizen",
      description: "test",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.CITIZEN],
      scopeType: "PUBLIC",
    });
    const user = await User.create({
      firstName: "S",
      lastName: "K",
      email: "session@example.com",
      passwordHash: HASH,
      roleId: role._id,
    });

    const session = await RefreshSession.create({
      userId: user._id,
      tokenHash: HASH,
      familyId: new Types.ObjectId().toString(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const listed = await RefreshSession.findById(session._id);
    expect(listed?.tokenHash).toBeUndefined();
    expect(listed?.userId.toString()).toBe(user._id.toString());

    const indexes = await RefreshSession.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds === 0);
    expect(ttl?.key).toMatchObject({ expiresAt: 1 });
    const hashIndex = indexes.find(
      (index) => index.key && "tokenHash" in index.key && index.unique === true,
    );
    expect(hashIndex).toBeDefined();

    const loaded = await RefreshSession.findById(session._id).select("+tokenHash");
    expect(loaded?.toObject()).not.toHaveProperty("tokenHash");

    await expect(
      RefreshSession.create({
        userId: user._id,
        tokenHash: HASH,
        familyId: new Types.ObjectId().toString(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toThrow();
  });
});
