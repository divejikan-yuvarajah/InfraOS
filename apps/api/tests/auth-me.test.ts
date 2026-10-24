import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { resetAuthNowForTests, setAuthNowForTests } from "../src/modules/identity/auth/auth.clock.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { consumePasswordReset } from "../src/modules/identity/password-reset-consume.service.js";
import { createMemoryPasswordResetSender } from "../src/modules/identity/password-reset-mail.js";
import { requestPasswordReset } from "../src/modules/identity/password-reset-request.service.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const PASSWORD = "correct-horse-battery";
const NEXT_PASSWORD = "replacement-horse-battery";
const ACCESS = "access-secret-step44-0123456789abcdef";
const REFRESH = "refresh-secret-step44-0123456789abcdef";
const app = createApp();

function origin(): string {
  return env.FRONTEND_ORIGIN;
}

async function seedOfficer(email: string) {
  const role =
    (await Role.findOne({ key: "AGENCY_OFFICER" })) ??
    (await Role.create({
    key: "AGENCY_OFFICER",
    name: "Agency Officer",
    description: "test officer",
    permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
    scopeType: "AGENCY",
    isActive: true,
  }));
  const agency = await Agency.create({
    code: `ME_${email.replace(/[^A-Za-z0-9]/g, "").slice(0, 16).toUpperCase()}`,
    name: "Me Test Agency",
    type: "DEPARTMENT",
    status: "ACTIVE",
  });
  const user = await User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash: await hash(PASSWORD, 12),
    roleId: role._id,
    agencyId: agency._id,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 0,
  });
  return { role, agency, user };
}

async function login(email: string, password = PASSWORD) {
  return request(app)
    .post("/api/v1/auth/login")
    .set("Origin", origin())
    .set("Content-Type", "application/json")
    .send({ email, password });
}

describe("step 44 authenticated identity", { timeout: 90_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    resetAuthNowForTests();
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    vi.restoreAllMocks();
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("returns the safe user DTO for a current access token and rejects unsafe bearer forms", async () => {
    const { user } = await seedOfficer("me@example.com");
    const signedIn = await login("me@example.com");
    expect(signedIn.status).toBe(200);
    const token = signedIn.body.data.accessToken as string;
    const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.headers["cache-control"]).toContain("no-store");
    expect(me.body.success).toBe(true);
    expect(me.body.meta.requestId).toEqual(expect.any(String));
    expect(me.body.data.user).toMatchObject({
      id: user._id.toString(),
      email: "me@example.com",
      roleKey: "AGENCY_OFFICER",
      status: "ACTIVE",
      emailVerified: true,
    });
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");
    expect(JSON.stringify(me.body)).not.toContain(PASSWORD);
    expect(me.body.data.user.permissions).toBeUndefined();

    const cookie = String(signedIn.headers["set-cookie"]);
    const cookieOnly = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(cookieOnly.status).toBe(401);
    expect(cookieOnly.body.error.code).toBe("AUTH_REQUIRED");

    const missing = await request(app).get("/api/v1/auth/me");
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("AUTH_REQUIRED");
    for (const header of ["", "Basic dXNlcjpwYXNz", "Bearer", "Bearer ", "Bearer a b"]) {
      const sent = await request(app).get("/api/v1/auth/me").set("Authorization", header);
      expect(sent.status).toBe(401);
      expect(sent.body.error.code).toBe("AUTH_REQUIRED");
    }
    const duplicate = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}, Bearer ${token}`);
    expect(duplicate.status).toBe(401);

    const tampered = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token.slice(0, -2)}aa`);
    expect(tampered.status).toBe(401);

    const wrongIssuer = await new SignJWT({ typ: "access", ce: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("elsewhere")
      .setAudience("infraos-web")
      .setSubject(user._id.toString())
      .setJti("jti-issuer")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(ACCESS));
    const issuer = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${wrongIssuer}`);
    expect(issuer.status).toBe(401);

    const legacy = await new SignJWT({ typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("infraos-web")
      .setSubject(user._id.toString())
      .setJti("jti-legacy")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(ACCESS));
    const missingEpoch = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${legacy}`);
    expect(missingEpoch.status).toBe(401);
    expect(missingEpoch.body.error.code).toBe("AUTH_REQUIRED");

    const badSubToken = await signAccessToken("user-1", 0);
    const badSub = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${badSubToken}`);
    expect(badSub.status).toBe(401);

    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const nonePayload = Buffer.from(
      JSON.stringify({
        sub: user._id.toString(),
        typ: "access",
        ce: 0,
        iss: "infraos-api",
        aud: "infraos-web",
        jti: "jti-none",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    ).toString("base64url");
    const none = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${noneHeader}.${nonePayload}.`);
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe("AUTH_REQUIRED");

    const wrongAudience = await new SignJWT({ typ: "access", ce: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("elsewhere")
      .setSubject(user._id.toString())
      .setJti("jti-aud")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(ACCESS));
    expect(
      (await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${wrongAudience}`)).status,
    ).toBe(401);

    const wrongType = await new SignJWT({ typ: "refresh", ce: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("infraos-web")
      .setSubject(user._id.toString())
      .setJti("jti-typ")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(ACCESS));
    expect(
      (await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${wrongType}`)).status,
    ).toBe(401);

    const future = await new SignJWT({ typ: "access", ce: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("infraos-web")
      .setSubject(user._id.toString())
      .setJti("jti-future")
      .setIssuedAt(Math.floor(Date.now() / 1000) + 120)
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(ACCESS));
    expect(
      (await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${future}`)).body.error.code,
    ).toBe("AUTH_REQUIRED");

    const otherSecret = await new SignJWT({ typ: "access", ce: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("infraos-api")
      .setAudience("infraos-web")
      .setSubject(user._id.toString())
      .setJti("jti-secret")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("different-access-secret-0123456789abcd"));
    const forged = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${otherSecret}`);
    expect(forged.status).toBe(401);
    expect(JSON.stringify(forged.body)).not.toContain(token);

    setAuthNowForTests(() => new Date(Date.now() + 20 * 60 * 1000));
    const expired = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("rejects the account when eligibility or the credential epoch changes after issuance", async () => {
    const { role, agency, user } = await seedOfficer("later@example.com");
    const token = (await login("later@example.com")).body.data.accessToken as string;

    user.status = "DISABLED";
    await user.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    user.status = "SUSPENDED";
    await user.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    user.status = "PENDING";
    await user.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    user.status = "ACTIVE";
    user.emailVerified = false;
    await user.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    user.emailVerified = true;
    await user.save();

    role.isActive = false;
    await role.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    role.isActive = true;
    await role.save();

    agency.status = "INACTIVE";
    await agency.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    agency.status = "ACTIVE";
    await agency.save();

    user.credentialEpoch = 1;
    await user.save();
    const staleEpoch = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(staleEpoch.status).toBe(401);
    expect(staleEpoch.body.error.code).toBe("SESSION_EXPIRED");
    const current = await signAccessToken(user._id.toString(), 1);
    const fresh = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${current.token}`);
    expect(fresh.status).toBe(200);
    user.credentialEpoch = 0;
    await user.save();

    await Agency.deleteOne({ _id: agency._id });
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    const restoredAgency = await Agency.create({
      code: "ME_RESTORED",
      name: "Me Test Agency",
      type: "DEPARTMENT",
      status: "ACTIVE",
    });
    user.agencyId = restoredAgency._id;
    await user.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(200);

    await Role.deleteOne({ _id: role._id });
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);

    user.agencyId = null;
    await user.save();
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    user.agencyId = agency._id;
    await user.save();

    await User.deleteOne({ _id: user._id });
    expect((await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });

  it("rejects a pre-reset access token and accepts the token issued after the new password", async () => {
    await seedOfficer("reset-me@example.com");
    await seedOfficer("other-me@example.com");
    const first = await login("reset-me@example.com");
    const other = await login("other-me@example.com");
    const stale = first.body.data.accessToken as string;
    const otherToken = other.body.data.accessToken as string;
    const sender = createMemoryPasswordResetSender();
    await requestPasswordReset({
      email: "reset-me@example.com",
      sender,
      allowlistedOrigin: origin(),
    });
    const resetToken = sender.captured()[0]?.token;
    expect(resetToken).toEqual(expect.any(String));
    const consumed = await consumePasswordReset({
      token: resetToken ?? "",
      password: NEXT_PASSWORD,
    });
    expect(consumed.ok).toBe(true);
    const staleMe = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${stale}`);
    expect(staleMe.status).toBe(401);
    expect(staleMe.body.error.code).toBe("SESSION_EXPIRED");
    const otherMe = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${otherToken}`);
    expect(otherMe.status).toBe(200);
    expect(otherMe.body.data.user.email).toBe("other-me@example.com");
    const oldLogin = await login("reset-me@example.com", PASSWORD);
    expect(oldLogin.status).toBe(401);
    const next = await login("reset-me@example.com", NEXT_PASSWORD);
    expect(next.status).toBe(200);
    const current = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${next.body.data.accessToken}`);
    expect(current.status).toBe(200);
    expect(current.body.data.user.email).toBe("reset-me@example.com");
  });

  it("returns 503 when identity storage fails and leaves public routes unprotected", async () => {
    await seedOfficer("down@example.com");
    const token = (await login("down@example.com")).body.data.accessToken as string;
    vi.spyOn(User, "findById").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const down = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(down.status).toBe(503);
    expect(down.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(down.body)).not.toContain("database unavailable");
    vi.restoreAllMocks();

    env.ACCESS_TOKEN_SECRET = "short";
    const secrets = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(secrets.status).toBe(503);
    env.ACCESS_TOKEN_SECRET = ACCESS;

    const health = await request(app).get("/api/v1/health");
    expect(health.status).toBe(200);
    const loginShape = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin())
      .set("Content-Type", "application/json")
      .send({});
    expect(loginShape.status).toBe(400);
    expect(loginShape.body.error.code).toBe("VALIDATION_ERROR");
    const refresh = await request(app).post("/api/v1/auth/refresh").set("Origin", origin());
    expect(refresh.status).toBe(401);
    expect(refresh.body.error.code).toBe("SESSION_EXPIRED");
    const ready = await request(app).get("/api/v1/ready");
    expect(ready.status).toBe(200);
    const forgot = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Origin", origin())
      .set("Content-Type", "application/json")
      .send({});
    expect(forgot.status).toBe(400);
    expect(forgot.body.error.code).toBe("VALIDATION_ERROR");
    const verify = await request(app)
      .post("/api/v1/auth/verify-email")
      .set("Origin", origin())
      .set("Content-Type", "application/json")
      .send({});
    expect(verify.status).toBe(400);
    expect(verify.body.error.code).toBe("VALIDATION_ERROR");
    const logout = await request(app).post("/api/v1/auth/logout").set("Origin", origin());
    expect(logout.status).toBe(204);
    const postMe = await request(app).post("/api/v1/auth/me").set("Origin", origin());
    expect(postMe.status).toBe(404);
  });
});
