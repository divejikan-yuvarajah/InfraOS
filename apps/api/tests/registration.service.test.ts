import { compare } from "bcryptjs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { NON_LOGIN_PASSWORD_HASH } from "../src/database/seeds/helpers/fixture-users.js";
import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import {
  RegistrationConflictError,
  RegistrationDeniedError,
  RegistrationPolicyBlockedError,
  provisionStaff,
  rejectAnonymousStaffRegistration,
  requestCitizenRegistration,
} from "../src/modules/identity/registration.service.js";
import { RegistrationInputError } from "../src/modules/identity/registration.schema.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import {
  clearCoreCollections,
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";
import type { TrustedProvisioningActor } from "../src/modules/identity/registration.types.js";

const ACTOR: TrustedProvisioningActor = {
  source: "server-internal",
  capability: "identity.provision",
  actorUserId: null,
};

const PASSWORD = "correct-horse-battery";

async function seedOfficerRole() {
  return Role.create({
    key: "AGENCY_OFFICER",
    name: "Agency Officer",
    description: "test",
    permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
    scopeType: "AGENCY",
    isActive: true,
  });
}

async function seedAgency() {
  return Agency.create({
    code: "DEMO_RDA",
    name: "Demo Road Authority",
    type: "ROAD",
    status: "ACTIVE",
  });
}

describe("staff provisioning", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
    await Role.syncIndexes();
    await User.syncIndexes();
    await Agency.syncIndexes();
    await RefreshSession.syncIndexes();
  });

  afterEach(async () => {
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("creates a pending unverified user with a cost-12 hash and no session", async () => {
    await seedOfficerRole();
    const agency = await seedAgency();
    const result = await provisionStaff(
      {
        firstName: "  Nimal ",
        lastName: "Silva",
        email: "  Nimal@Example.com ",
        password: PASSWORD,
        roleKey: "AGENCY_OFFICER",
        agencyCode: "demo_rda",
      },
      ACTOR,
    );

    expect(result.user.status).toBe("PENDING");
    expect(result.user.emailVerified).toBe(false);
    expect(result.user.roleKey).toBe("AGENCY_OFFICER");
    expect(result.user.agencyId).toBe(agency._id.toString());
    expect(result.user.nextAction).toBe("VERIFY_EMAIL");
    expect(result.user).not.toHaveProperty("password");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("email");
    expect(JSON.stringify(result.audit)).not.toContain(PASSWORD);

    const stored = await User.findById(result.user.id).select("+passwordHash");
    expect(stored?.email).toBe("nimal@example.com");
    expect(stored?.status).toBe("PENDING");
    expect(stored?.emailVerified).toBe(false);
    expect(stored?.passwordHash?.startsWith("$2")).toBe(true);
    expect(stored?.passwordHash).toContain("$12$");
    expect(stored?.passwordHash).not.toBe(PASSWORD);
    expect(await compare(PASSWORD, stored?.passwordHash ?? "")).toBe(true);
    expect(await compare("wrong-password", stored?.passwordHash ?? "")).toBe(false);
    expect(await RefreshSession.countDocuments({ userId: stored?._id })).toBe(0);
    expect(stored?.toObject()).not.toHaveProperty("passwordHash");
  });

  it("rejects passwords longer than 72 UTF-8 bytes and accepts the boundary", async () => {
    await seedOfficerRole();
    await seedAgency();
    await expect(
      provisionStaff(
        {
          firstName: "A",
          lastName: "B",
          email: "long@example.com",
          password: "é".repeat(40),
          roleKey: "AGENCY_OFFICER",
          agencyCode: "DEMO_RDA",
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(RegistrationInputError);
    expect(Buffer.byteLength("é".repeat(40), "utf8")).toBeGreaterThan(72);

    const created = await provisionStaff(
      {
        firstName: "A",
        lastName: "B",
        email: "edge@example.com",
        password: "a".repeat(72),
        roleKey: "AGENCY_OFFICER",
        agencyCode: "DEMO_RDA",
      },
      ACTOR,
    );
    const stored = await User.findById(created.user.id).select("+passwordHash");
    expect(await compare("a".repeat(72), stored?.passwordHash ?? "")).toBe(true);
  });

  it("does not let the demo sentinel hash authenticate", async () => {
    expect(await compare(PASSWORD, NON_LOGIN_PASSWORD_HASH)).toBe(false);
    expect(NON_LOGIN_PASSWORD_HASH.startsWith("$2")).toBe(false);
  });

  it("denies anonymous staff signup and citizen signup", async () => {
    await seedOfficerRole();
    await seedAgency();
    await expect(
      rejectAnonymousStaffRegistration({
        firstName: "A",
        lastName: "B",
        email: "anon@example.com",
        password: PASSWORD,
        roleKey: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerified: true,
      }),
    ).rejects.toBeInstanceOf(RegistrationInputError);
    await expect(requestCitizenRegistration({ email: "citizen@example.com" })).rejects.toBeInstanceOf(
      RegistrationPolicyBlockedError,
    );
    await expect(
      provisionStaff(
        {
          firstName: "A",
          lastName: "B",
          email: "nope@example.com",
          password: PASSWORD,
          roleKey: "AGENCY_OFFICER",
          agencyCode: "DEMO_RDA",
        },
        { source: "http", capability: "identity.provision", actorUserId: null } as never,
      ),
    ).rejects.toBeInstanceOf(RegistrationDeniedError);
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects mass-assignment fields and inactive agency", async () => {
    await seedOfficerRole();
    await Agency.create({
      code: "DEMO_OLD",
      name: "Inactive",
      type: "OTHER",
      status: "INACTIVE",
    });
    await expect(
      provisionStaff(
        {
          firstName: "A",
          lastName: "B",
          email: "mass@example.com",
          password: PASSWORD,
          roleKey: "AGENCY_OFFICER",
          agencyCode: "DEMO_RDA",
          status: "ACTIVE",
          emailVerified: true,
        } as never,
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(RegistrationInputError);
    await expect(
      provisionStaff(
        {
          firstName: "A",
          lastName: "B",
          email: "old@example.com",
          password: PASSWORD,
          roleKey: "AGENCY_OFFICER",
          agencyCode: "DEMO_OLD",
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(RegistrationInputError);
    expect(await User.countDocuments()).toBe(0);
  });

  it("maps duplicate emails including a concurrent pair", async () => {
    await seedOfficerRole();
    await seedAgency();
    const input = {
      firstName: "One",
      lastName: "User",
      email: "dup@example.com",
      password: PASSWORD,
      roleKey: "AGENCY_OFFICER" as const,
      agencyCode: "DEMO_RDA",
    };
    const [first, second] = await Promise.allSettled([
      provisionStaff(input, ACTOR),
      provisionStaff({ ...input, firstName: "Two" }, ACTOR),
    ]);
    const fulfilled = [first, second].filter((item) => item.status === "fulfilled");
    const rejected = [first, second].filter((item) => item.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RegistrationConflictError);
    expect(await User.countDocuments()).toBe(1);
    const stored = await User.findOne();
    expect(stored?.email).toBe("dup@example.com");
  });

  it("hides database failures", async () => {
    await seedOfficerRole();
    await seedAgency();
    const model = User as unknown as {
      create: (...args: unknown[]) => Promise<unknown>;
    };
    const original = model.create;
    model.create = async () => {
      throw new Error("mongodb://secret-host password=plaintext");
    };
    try {
      await expect(
        provisionStaff(
          {
            firstName: "A",
            lastName: "B",
            email: "down@example.com",
            password: PASSWORD,
            roleKey: "AGENCY_OFFICER",
            agencyCode: "DEMO_RDA",
          },
          ACTOR,
        ),
      ).rejects.toEqual(expect.objectContaining({
        name: "RegistrationDependencyError",
        message: "registration could not be stored",
      }));
    } finally {
      model.create = original;
    }
  });
});
