import { compare, hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { loginWithPassword } from "../src/modules/identity/auth/auth.service.js";
import {
  loginIssuanceHooks,
  refreshRotationHooks,
  resetLoginIssuanceHooks,
  resetRefreshRotationHooks,
  rotateRefreshSession,
} from "../src/modules/identity/auth/refresh-session.service.js";
import { PasswordResetChallenge } from "../src/modules/identity/models/password-reset-challenge.model.js";
import { RefreshFamily } from "../src/modules/identity/models/refresh-family.model.js";
import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import {
  consumePasswordReset,
  passwordResetConsumeHooks,
  resetPasswordResetConsumeHooks,
} from "../src/modules/identity/password-reset-consume.service.js";
import { createMemoryPasswordResetSender } from "../src/modules/identity/password-reset-mail.js";
import { requestPasswordReset } from "../src/modules/identity/password-reset-request.service.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const OLD_PASSWORD = "correct-horse-battery";
const NEW_PASSWORD = "replacement-horse-battery";
const ORIGIN = "http://localhost:3000";
const app = createApp();

async function seedUser(email: string) {
  const role =
    (await Role.findOne({ key: "AGENCY_OFFICER" })) ??
    (await Role.create({
      key: "AGENCY_OFFICER",
      name: "Agency Officer",
      description: "test",
      permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
      scopeType: "AGENCY",
      isActive: true,
    }));
  const agency = await Agency.create({
    code: `C42_${email.replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase()}`,
    name: "Reset Consume Agency",
    type: "DEPARTMENT",
    status: "ACTIVE",
  });
  return User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash: await hash(OLD_PASSWORD, 12),
    roleId: role._id,
    agencyId: agency._id,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 0,
  });
}

async function issueToken(email: string, now = new Date()) {
  const sender = createMemoryPasswordResetSender();
  await requestPasswordReset({
    email,
    sender,
    allowlistedOrigin: ORIGIN,
    now,
  });
  const token = sender.captured()[0]?.token;
  if (!token) throw new Error("expected a reset token");
  return token;
}

describe("step 42 password reset consumption", { timeout: 90_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step42-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step42-0123456789abcdef";
    await startIsolatedMongo();
    await RefreshFamily.syncIndexes();
    await PasswordResetChallenge.syncIndexes();
    const indexes = await RefreshFamily.collection.indexes();
    const userIndex = indexes.find((index) => index.name === "userId_1_closedAt_1");
    const familyIndex = indexes.find((index) => index.key.familyId === 1);
    expect(userIndex?.unique).not.toBe(true);
    expect(familyIndex?.unique).toBe(true);
  }, 300_000);

  afterEach(async () => {
    resetPasswordResetConsumeHooks();
    resetLoginIssuanceHooks();
    resetRefreshRotationHooks();
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("replaces the hash, bumps the epoch, and closes every family for that user only", async () => {
    const user = await seedUser("reset@example.com");
    const other = await seedUser("other@example.com");
    const first = await loginWithPassword({
      email: user.email,
      password: OLD_PASSWORD,
      requestId: "a",
    });
    const second = await loginWithPassword({
      email: user.email,
      password: OLD_PASSWORD,
      requestId: "b",
    });
    const outsider = await loginWithPassword({
      email: other.email,
      password: OLD_PASSWORD,
      requestId: "c",
    });
    expect(first && second && outsider).toBeTruthy();
    const token = await issueToken(user.email);
    const result = await consumePasswordReset({ token, password: NEW_PASSWORD });
    expect(result).toEqual({ ok: true });
    const stored = await User.findById(user._id).select("+passwordHash");
    expect(stored?.credentialEpoch).toBe(1);
    expect(stored?.status).toBe("ACTIVE");
    expect(await compare(NEW_PASSWORD, stored!.passwordHash)).toBe(true);
    expect(await compare(OLD_PASSWORD, stored!.passwordHash)).toBe(false);
    expect(await RefreshFamily.countDocuments({ userId: user._id, closedAt: null })).toBe(0);
    expect(await RefreshFamily.countDocuments({ userId: other._id, closedAt: null })).toBe(1);
    expect((await rotateRefreshSession({ refreshToken: first!.refreshToken })).ok).toBe(false);
    expect((await rotateRefreshSession({ refreshToken: second!.refreshToken })).ok).toBe(false);
    expect((await rotateRefreshSession({ refreshToken: outsider!.refreshToken })).ok).toBe(true);
  });

  it("rejects a second use, an expired row, a revoked row, and a short password", async () => {
    await seedUser("once@example.com");
    const token = await issueToken("once@example.com");
    expect(await consumePasswordReset({ token, password: "short" })).toEqual({
      ok: false,
      reason: "rejected",
    });
    expect((await User.findOne({ email: "once@example.com" }))?.credentialEpoch).toBe(0);
    expect(await consumePasswordReset({ token, password: NEW_PASSWORD })).toEqual({ ok: true });
    expect(await consumePasswordReset({ token, password: `${NEW_PASSWORD}-2` })).toEqual({
      ok: false,
      reason: "rejected",
    });

    await seedUser("stale@example.com");
    const expired = await issueToken("stale@example.com");
    await PasswordResetChallenge.updateOne(
      { email: "stale@example.com", consumedAt: null },
      { $set: { expiresAt: new Date("2020-01-01T00:00:00.000Z") } },
    );
    expect(await consumePasswordReset({ token: expired, password: NEW_PASSWORD })).toEqual({
      ok: false,
      reason: "rejected",
    });

    await seedUser("revoked@example.com");
    const revoked = await issueToken("revoked@example.com");
    await PasswordResetChallenge.updateOne(
      { email: "revoked@example.com", consumedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    expect(await consumePasswordReset({ token: revoked, password: NEW_PASSWORD })).toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it("does not change a disabled account and rolls back when the transaction throws", async () => {
    const disabled = await seedUser("disabled@example.com");
    const token = await issueToken(disabled.email);
    await User.updateOne({ _id: disabled._id }, { $set: { status: "DISABLED" } });
    expect(await consumePasswordReset({ token, password: NEW_PASSWORD })).toEqual({
      ok: false,
      reason: "rejected",
    });
    const after = await User.findById(disabled._id).select("+passwordHash");
    expect(after?.status).toBe("DISABLED");
    expect(after?.credentialEpoch).toBe(0);
    expect(await compare(OLD_PASSWORD, after!.passwordHash)).toBe(true);
    expect(await PasswordResetChallenge.countDocuments({ userId: disabled._id, consumedAt: null })).toBe(1);

    const live = await seedUser("boom@example.com");
    const liveToken = await issueToken(live.email);
    passwordResetConsumeHooks.beforeEpochWrite = async () => {
      throw new Error("db-down");
    };
    expect(await consumePasswordReset({ token: liveToken, password: NEW_PASSWORD })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const unchanged = await User.findById(live._id).select("+passwordHash");
    expect(unchanged?.credentialEpoch).toBe(0);
    expect(await compare(OLD_PASSWORD, unchanged!.passwordHash)).toBe(true);
    expect(await PasswordResetChallenge.countDocuments({ userId: live._id, consumedAt: null, revokedAt: null })).toBe(1);
  });

  it("lets one of two concurrent consumes commit", async () => {
    await seedUser("race@example.com");
    const token = await issueToken("race@example.com");
    let waiting = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    passwordResetConsumeHooks.beforeEpochWrite = async () => {
      waiting += 1;
      await gate;
    };
    const pending = Promise.all([
      consumePasswordReset({ token, password: NEW_PASSWORD }),
      consumePasswordReset({ token, password: `${NEW_PASSWORD}x` }),
    ]);
    const started = Date.now();
    while (waiting < 1 && Date.now() - started < 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(1);
    release();
    const results = await pending;
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect((await User.findOne({ email: "race@example.com" }))?.credentialEpoch).toBe(1);
  });

  it("does not issue a session when reset commits after the old password matched", async () => {
    const user = await seedUser("overlap@example.com");
    const token = await issueToken(user.email);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    loginIssuanceHooks.beforeFamilyInsert = () => gate;
    const pending = loginWithPassword({
      email: user.email,
      password: OLD_PASSWORD,
      requestId: "overlap",
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await consumePasswordReset({ token, password: NEW_PASSWORD })).toEqual({ ok: true });
    release();
    expect(await pending).toBeNull();
    expect(await RefreshFamily.countDocuments({ userId: user._id, closedAt: null })).toBe(0);
    expect(await loginWithPassword({
      email: user.email,
      password: NEW_PASSWORD,
      requestId: "after",
    })).toBeTruthy();
  });

  it("stops a refresh that claimed or swapped before reset", async () => {
    const user = await seedUser("refresh@example.com");
    const issued = await loginWithPassword({
      email: user.email,
      password: OLD_PASSWORD,
      requestId: "r1",
    });
    const token = await issueToken(user.email);
    let releaseClaim: () => void = () => {};
    const claimGate = new Promise<void>((resolve) => {
      releaseClaim = resolve;
    });
    refreshRotationHooks.afterClaim = () => claimGate;
    const claimed = rotateRefreshSession({ refreshToken: issued!.refreshToken });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await consumePasswordReset({ token, password: NEW_PASSWORD })).toEqual({ ok: true });
    releaseClaim();
    expect((await claimed).ok).toBe(false);

    const again = await loginWithPassword({
      email: user.email,
      password: NEW_PASSWORD,
      requestId: "r2",
    });
    const secondToken = await issueToken(user.email, new Date(Date.now() + 120_000));
    let releaseSwap: () => void = () => {};
    const swapGate = new Promise<void>((resolve) => {
      releaseSwap = resolve;
    });
    refreshRotationHooks.afterAuthoritySwap = () => swapGate;
    const swapped = rotateRefreshSession({ refreshToken: again!.refreshToken });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await consumePasswordReset({ token: secondToken, password: `${NEW_PASSWORD}-2` })).toEqual({
      ok: true,
    });
    releaseSwap();
    expect((await swapped).ok).toBe(false);
    expect(await RefreshSession.countDocuments({
      userId: user._id,
      revokedAt: null,
    })).toBe(0);
  });

  it("treats a missing credentialEpoch as zero and then stores one", async () => {
    const user = await seedUser("legacy@example.com");
    await User.collection.updateOne({ _id: user._id }, { $unset: { credentialEpoch: "" } });
    const issued = await loginWithPassword({
      email: user.email,
      password: OLD_PASSWORD,
      requestId: "legacy",
    });
    expect(issued).toBeTruthy();
    await RefreshFamily.collection.updateOne(
      { userId: user._id },
      { $unset: { credentialEpoch: "" } },
    );
    expect((await rotateRefreshSession({ refreshToken: issued!.refreshToken })).ok).toBe(true);
    const token = await issueToken(user.email, new Date(Date.now() + 120_000));
    expect(await consumePasswordReset({ token, password: NEW_PASSWORD })).toEqual({ ok: true });
    const stored = await User.findById(user._id).select("+passwordHash");
    expect(stored?.credentialEpoch).toBe(1);
    expect(await compare(NEW_PASSWORD, stored!.passwordHash)).toBe(true);
  });

  it("returns RESET without a cookie and rejects a foreign origin", async () => {
    await seedUser("http@example.com");
    const token = await issueToken("http@example.com");
    const ok = await request(app)
      .post("/api/v1/auth/reset-password")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({ token, password: NEW_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ status: "RESET" });
    expect(ok.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(ok.body)).not.toContain(token);

    const denied = await request(app)
      .post("/api/v1/auth/reset-password")
      .set("Origin", "https://evil.example")
      .set("Content-Type", "application/json")
      .send({ token: "a".repeat(43), password: NEW_PASSWORD });
    expect(denied.status).toBe(403);
  });
});
