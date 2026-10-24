import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { PasswordResetChallenge } from "../src/modules/identity/models/password-reset-challenge.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import {
  createMemoryPasswordResetSender,
  createUnavailablePasswordResetSender,
  passwordResetLink,
} from "../src/modules/identity/password-reset-mail.js";
import {
  digestResetToken,
  passwordResetAuditEvents,
  passwordResetIssuanceHooks,
  requestPasswordReset,
  RESET_COOLDOWN_MS,
  resetPasswordResetAuditForTests,
  resetPasswordResetIssuanceHooks,
  resetTokenShape,
} from "../src/modules/identity/password-reset-request.service.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const PASSWORD = "correct-horse-battery";
const ORIGIN = "http://localhost:3000";
const app = createApp();

async function seedUser(email: string, patch: Record<string, unknown> = {}) {
  const role = await Role.create({
    key: "AGENCY_OFFICER",
    name: "Agency Officer",
    description: "test",
    permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
    scopeType: "AGENCY",
    isActive: true,
  });
  const agency = await Agency.create({
    code: `RST_${email.slice(0, 6).replace(/[^A-Za-z0-9]/g, "X").toUpperCase()}`,
    name: "Reset Test Agency",
    type: "DEPARTMENT",
    status: "ACTIVE",
  });
  return User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash: await hash(PASSWORD, 12),
    roleId: role._id,
    agencyId: agency._id,
    status: "ACTIVE",
    emailVerified: true,
    ...patch,
  });
}

describe("step 41 password reset request", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
    await PasswordResetChallenge.syncIndexes();
  }, 300_000);

  afterEach(async () => {
    resetPasswordResetIssuanceHooks();
    resetPasswordResetAuditForTests();
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("returns the same accepted result for unknown and ineligible accounts", async () => {
    await seedUser("pending@example.com", { status: "PENDING", emailVerified: false });
    const sender = createMemoryPasswordResetSender();
    const unknown = await requestPasswordReset({
      email: "missing@example.com",
      sender,
      allowlistedOrigin: ORIGIN,
    });
    const pending = await requestPasswordReset({
      email: "pending@example.com",
      sender,
      allowlistedOrigin: ORIGIN,
    });
    expect(unknown).toEqual({ accepted: true });
    expect(pending).toEqual(unknown);
    expect(sender.captured()).toHaveLength(0);
    expect(await PasswordResetChallenge.countDocuments()).toBe(0);
  });

  it("issues a 256-bit digest and a fragment link for an eligible account", async () => {
    await seedUser("officer@example.com");
    const sender = createMemoryPasswordResetSender();
    const result = await requestPasswordReset({
      email: "Officer@Example.com",
      sender,
      allowlistedOrigin: ORIGIN,
    });
    expect(result).toEqual({ accepted: true });
    const message = sender.captured()[0];
    expect(message).toBeDefined();
    expect(resetTokenShape(message!.token)).toBe(true);
    expect(message!.token).toHaveLength(43);
    expect(message!.link).toBe(
      `${ORIGIN}/reset-password#token=${encodeURIComponent(message!.token)}`,
    );
    expect(message!.link).not.toContain("?");
    expect(passwordResetLink(ORIGIN, message!.token)).toBe(message!.link);
    const stored = await PasswordResetChallenge.findOne({ email: "officer@example.com" }).select(
      "+tokenHash",
    );
    expect(stored?.tokenHash).toBe(digestResetToken(message!.token));
    expect(stored?.tokenHash).not.toBe(message!.token);
    expect(JSON.stringify(stored?.toJSON() ?? {})).not.toContain(message!.token);
    const serialized = JSON.stringify(passwordResetAuditEvents());
    expect(serialized).not.toContain(message!.token);
    expect(serialized).not.toContain(stored!.tokenHash);
  });

  it("does not issue during the account cooldown and supersedes an expired open challenge", async () => {
    const user = await seedUser("again@example.com");
    const sender = createMemoryPasswordResetSender();
    const firstAt = new Date("2026-10-24T10:00:00.000Z");
    await requestPasswordReset({
      email: user.email,
      sender,
      allowlistedOrigin: ORIGIN,
      now: firstAt,
    });
    const during = createMemoryPasswordResetSender();
    await requestPasswordReset({
      email: user.email,
      sender: during,
      allowlistedOrigin: ORIGIN,
      now: new Date(firstAt.getTime() + RESET_COOLDOWN_MS - 1),
    });
    expect(during.captured()).toHaveLength(0);

    await PasswordResetChallenge.updateOne(
      { userId: user._id, revokedAt: null },
      { $set: { expiresAt: firstAt, issuedAt: new Date(firstAt.getTime() - 120_000) } },
    );
    const later = createMemoryPasswordResetSender();
    await requestPasswordReset({
      email: user.email,
      sender: later,
      allowlistedOrigin: ORIGIN,
      now: new Date(firstAt.getTime() + RESET_COOLDOWN_MS + 5_000),
    });
    expect(later.captured()).toHaveLength(1);
    const open = await PasswordResetChallenge.countDocuments({
      userId: user._id,
      consumedAt: null,
      revokedAt: null,
    });
    expect(open).toBe(1);
  });

  it("keeps one live challenge when two requests race", async () => {
    await seedUser("race@example.com");
    let waiting = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    passwordResetIssuanceHooks.beforeInsert = async () => {
      waiting += 1;
      await gate;
    };
    const first = createMemoryPasswordResetSender();
    const second = createMemoryPasswordResetSender();
    const pending = Promise.all([
      requestPasswordReset({
        email: "race@example.com",
        sender: first,
        allowlistedOrigin: ORIGIN,
      }),
      requestPasswordReset({
        email: "race@example.com",
        sender: second,
        allowlistedOrigin: ORIGIN,
      }),
    ]);
    const started = Date.now();
    while (waiting < 2 && Date.now() - started < 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(2);
    release();
    const results = await pending;
    expect(results).toEqual([{ accepted: true }, { accepted: true }]);
    const open = await PasswordResetChallenge.countDocuments({
      consumedAt: null,
      revokedAt: null,
    });
    expect(open).toBe(1);
    expect(first.captured().length + second.captured().length).toBe(1);
  });

  it("does not store a challenge when delivery is unavailable or send fails", async () => {
    await seedUser("quiet@example.com");
    const unavailable = await requestPasswordReset({
      email: "quiet@example.com",
      sender: createUnavailablePasswordResetSender(),
      allowlistedOrigin: ORIGIN,
    });
    expect(unavailable).toEqual({ accepted: true });
    expect(await PasswordResetChallenge.countDocuments()).toBe(0);

    const failing = createMemoryPasswordResetSender();
    failing.send = async () => {
      throw new Error("provider-down");
    };
    await requestPasswordReset({
      email: "quiet@example.com",
      sender: failing,
      allowlistedOrigin: ORIGIN,
    });
    const open = await PasswordResetChallenge.countDocuments({ revokedAt: null });
    expect(open).toBe(0);
    expect(failing.captured()).toHaveLength(0);
  });

  it("restores the previously delivered challenge when a later send fails", async () => {
    const user = await seedUser("restore@example.com");
    const first = createMemoryPasswordResetSender();
    const issuedAt = new Date("2026-10-24T12:00:00.000Z");
    await requestPasswordReset({
      email: user.email,
      sender: first,
      allowlistedOrigin: ORIGIN,
      now: issuedAt,
    });
    const firstHash = digestResetToken(first.captured()[0]!.token);
    const failing = createMemoryPasswordResetSender();
    failing.send = async () => {
      throw new Error("provider-down");
    };
    await requestPasswordReset({
      email: user.email,
      sender: failing,
      allowlistedOrigin: ORIGIN,
      now: new Date(issuedAt.getTime() + RESET_COOLDOWN_MS + 1_000),
    });
    const live = await PasswordResetChallenge.find({
      userId: user._id,
      consumedAt: null,
      revokedAt: null,
    }).select("+tokenHash");
    expect(live).toHaveLength(1);
    expect(live[0]?.tokenHash).toBe(firstHash);
    const fresh = await User.findById(user._id);
    expect(fresh?.status).toBe("ACTIVE");
    expect(fresh?.emailVerified).toBe(true);
  });

  it("does not issue for a disabled or unverified account and does not change them", async () => {
    const disabled = await seedUser("disabled@example.com", { status: "DISABLED" });
    const unverified = await User.create({
      firstName: "Nila",
      lastName: "Perera",
      email: "unverified@example.com",
      passwordHash: await hash(PASSWORD, 12),
      roleId: disabled.roleId,
      agencyId: disabled.agencyId,
      status: "ACTIVE",
      emailVerified: false,
    });
    const sender = createMemoryPasswordResetSender();
    await requestPasswordReset({
      email: disabled.email,
      sender,
      allowlistedOrigin: ORIGIN,
    });
    await requestPasswordReset({
      email: unverified.email,
      sender,
      allowlistedOrigin: ORIGIN,
    });
    expect(sender.captured()).toHaveLength(0);
    expect((await User.findById(disabled._id))?.status).toBe("DISABLED");
    expect((await User.findById(unverified._id))?.emailVerified).toBe(false);
  });

  it("returns 403 when both Origin and Referer are absent", async () => {
    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Content-Type", "application/json")
      .send({ email: "nobody@example.com" });
    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain("nobody@example.com");
  });

  it("rejects malformed bodies, extra fields, and a foreign origin", async () => {
    const unknown = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({ email: "nobody@example.com" });
    expect(unknown.status).toBe(200);
    expect(unknown.body.data).toEqual({ status: "ACCEPTED" });
    expect(unknown.headers["cache-control"]).toBe("no-store");
    expect(unknown.headers["referrer-policy"]).toBe("no-referrer");

    const badOrigin = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Origin", "https://evil.example")
      .set("Content-Type", "application/json")
      .send({ email: "nobody@example.com" });
    expect(badOrigin.status).toBe(403);

    const extra = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({ email: "nobody@example.com", returnTo: "https://evil.example" });
    expect(extra.status).toBe(400);

    const malformed = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "application/json")
      .send({ email: "not-an-email" });
    expect(malformed.status).toBe(400);

    const text = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("Origin", env.FRONTEND_ORIGIN)
      .set("Content-Type", "text/plain")
      .send("email=nobody@example.com");
    expect(text.status).toBe(415);
  });

  it("rate limits repeated forgot-password posts", async () => {
    let limited = 0;
    for (let i = 0; i < 45; i += 1) {
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .set("Origin", env.FRONTEND_ORIGIN)
        .set("Content-Type", "application/json")
        .send({ email: "limit@example.com" });
      if (response.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
