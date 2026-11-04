import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

/**
 * Policy (citizen Option A): every authenticated account, whatever its role, must belong to an ACTIVE agency.
 * User.agencyId stays nullable in the schema, but a user without an agency can never obtain or keep a session.
 * Citizen sign-in is therefore unsupported until a separate, reviewed change introduces a non-agency actor type.
 */
const PASSWORD = "correct-horse-battery";
const ROLES = Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[];
const app = createApp();

describe("authentication requires an active agency for every role", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-agency-inv-0123456789ab";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-agency-inv-0123456789a";
    await startIsolatedMongo();
  }, 300_000);
  afterEach(async () => { await clearCoreCollections(); });
  afterAll(async () => { await stopIsolatedMongo(); });

  async function seed(roleKey: SystemRoleKey, agencyStatus: "ACTIVE" | "INACTIVE" | null) {
    const role = (await Role.findOne({ key: roleKey })) ?? (await Role.create({ key: roleKey, name: SYSTEM_ROLE_META[roleKey].name, description: SYSTEM_ROLE_META[roleKey].description, permissions: [...SYSTEM_ROLE_PERMISSIONS[roleKey]], scopeType: SYSTEM_ROLE_META[roleKey].scopeType, isSystem: true, isActive: true }));
    const agency = agencyStatus ? await Agency.create({ code: `INV_${roleKey}_${agencyStatus}`, name: "Invariant agency", type: "DEPARTMENT", status: agencyStatus }) : null;
    const email = `${roleKey.toLowerCase()}-${agencyStatus ?? "none"}@example.com`;
    const user = await User.create({ firstName: "Test", lastName: "Account", email, passwordHash: await hash(PASSWORD, 4), roleId: role._id, agencyId: agency?._id ?? null, status: "ACTIVE", emailVerified: true, credentialEpoch: 1 });
    return { email, token: (await signAccessToken(user._id.toString(), 1)).token };
  }
  const me = (token: string) => request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
  const login = (email: string) => request(app).post("/api/v1/auth/login").set("Origin", env.FRONTEND_ORIGIN).set("Content-Type", "application/json").send({ email, password: PASSWORD });

  it("accepts all seven roles that belong to an active agency, including SUPER_ADMIN", async () => {
    expect(ROLES).toHaveLength(7);
    for (const role of ROLES) {
      const account = await seed(role, "ACTIVE");
      const out = await me(account.token);
      expect(out.status, role).toBe(200);
      expect(out.body.data.user.roleKey).toBe(role);
      expect(out.body.data.user.agencyId).toEqual(expect.any(String));
    }
  });

  it("rejects an access token for a user with no agency (SUPER_ADMIN and CITIZEN included)", async () => {
    for (const role of ROLES) expect((await me((await seed(role, null)).token)).status, role).toBe(401);
  });

  it("rejects an access token when the agency is not active", async () => {
    for (const role of ["SUPER_ADMIN", "AGENCY_OFFICER", "CITIZEN"] as const) expect((await me((await seed(role, "INACTIVE")).token)).status, role).toBe(401);
  });

  it("does not issue a session at login to an agency-less account", async () => {
    const citizen = await seed("CITIZEN", null);
    const out = await login(citizen.email);
    expect(out.status).toBe(401);
    expect(out.headers["set-cookie"]).toBeUndefined();
    expect(out.body.data?.accessToken).toBeUndefined();
  });
});
