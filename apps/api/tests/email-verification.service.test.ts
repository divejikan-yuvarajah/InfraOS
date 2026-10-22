import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { EmailVerificationChallenge } from "../src/modules/identity/models/email-verification-challenge.model.js";
import { RefreshSession } from "../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import {
  consumeEmailVerification,
  requestEmailVerification,
  RESEND_COOLDOWN_MS,
  VerificationDependencyError,
  verificationAuditEvents,
} from "../src/modules/identity/email-verification.service.js";
import { provisionStaff } from "../src/modules/identity/registration.service.js";
import { SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import {
  createMemoryVerificationSender,
  createUnavailableVerificationSender,
  verificationLink,
} from "../src/modules/identity/verification-mail.js";
import type { TrustedProvisioningActor } from "../src/modules/identity/registration.types.js";
import {
  clearCoreCollections,
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

const ACTOR: TrustedProvisioningActor = {
  source: "server-internal",
  capability: "identity.provision",
  actorUserId: null,
};

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery";

async function seedStaff(email = "nimal@example.com") {
  await Role.create({
    key: "AGENCY_OFFICER",
    name: "Agency Officer",
    description: "test",
    permissions: [...SYSTEM_ROLE_PERMISSIONS.AGENCY_OFFICER],
    scopeType: "AGENCY",
    isActive: true,
  });
  await Agency.create({
    code: "DEMO_RDA",
    name: "Demo Road Authority",
    type: "ROAD",
    status: "ACTIVE",
  });
  return provisionStaff(
    {
      firstName: "Nimal",
      lastName: "Silva",
      email,
      password: PASSWORD,
      roleKey: "AGENCY_OFFICER",
      agencyCode: "DEMO_RDA",
    },
    ACTOR,
  );
}

async function issue(email = "nimal@example.com", now = new Date()) {
  const sender = createMemoryVerificationSender();
  await requestEmailVerification({
    email,
    sender,
    allowlistedOrigin: ORIGIN,
    now,
  });
  const message = sender.captured()[0];
  if (!message) throw new Error("expected a verification message");
  return { sender, token: message.token, now };
}

describe("email verification", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await startIsolatedMongo();
    await Role.syncIndexes();
    await User.syncIndexes();
    await Agency.syncIndexes();
    await RefreshSession.syncIndexes();
    await EmailVerificationChallenge.syncIndexes();
  });

  afterEach(async () => {
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("verifies a pending user once and does not activate or open a session", async () => {
    const provisioned = await seedStaff();
    const { token } = await issue();
    const result = await consumeEmailVerification({ token });
    expect(result.ok).toBe(true);

    const stored = await User.findById(provisioned.user.id);
    expect(stored?.emailVerified).toBe(true);
    expect(stored?.status).toBe("PENDING");
    expect(await RefreshSession.countDocuments()).toBe(0);
    expect(await consumeEmailVerification({ token })).toEqual({ ok: false });
    const storedChallenge = await EmailVerificationChallenge.findOne().select("+tokenHash");
    expect(storedChallenge?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedChallenge?.tokenHash).not.toBe(token);
    expect(JSON.stringify(verificationAuditEvents())).not.toContain(token);
  });

  it("rejects an expired challenge that is still stored", async () => {
    await seedStaff();
    const { token } = await issue();
    const past = new Date(Date.now() - 1000);
    await EmailVerificationChallenge.updateMany({}, { $set: { expiresAt: past } });
    expect(await EmailVerificationChallenge.countDocuments()).toBe(1);
    expect(await consumeEmailVerification({ token, now: new Date() })).toEqual({ ok: false });
    expect((await User.findOne())?.emailVerified).toBe(false);
  });

  it("does not accept a challenge after the email changes", async () => {
    await seedStaff();
    const { token } = await issue();
    await User.updateOne({}, { $set: { email: "other@example.com" } });
    expect(await consumeEmailVerification({ token })).toEqual({ ok: false });
    expect((await User.findOne())?.emailVerified).toBe(false);
    expect((await EmailVerificationChallenge.findOne())?.usedAt).toBeNull();
  });

  it("does not verify disabled or suspended accounts", async () => {
    await seedStaff();
    const first = await issue();
    await User.updateOne({}, { $set: { status: "DISABLED" } });
    expect(await consumeEmailVerification({ token: first.token })).toEqual({ ok: false });
    expect((await EmailVerificationChallenge.findOne())?.usedAt).toBeNull();

    await User.updateOne({}, { $set: { status: "PENDING" } });
    const second = await issue(
      "nimal@example.com",
      new Date(Date.now() + RESEND_COOLDOWN_MS + 5_000),
    );
    await User.updateOne({}, { $set: { status: "SUSPENDED" } });
    expect(await consumeEmailVerification({ token: second.token })).toEqual({ ok: false });
    expect((await User.findOne())?.emailVerified).toBe(false);
  });

  it("invalidates the previous challenge on resend", async () => {
    await seedStaff();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const resentAt = new Date(issuedAt.getTime() + RESEND_COOLDOWN_MS);
    const first = await issue(undefined, issuedAt);
    const second = await issue(undefined, resentAt);
    expect(await consumeEmailVerification({ token: first.token, now: resentAt })).toEqual({
      ok: false,
    });
    expect((await consumeEmailVerification({ token: second.token, now: resentAt })).ok).toBe(true);
    expect((await User.findOne())?.status).toBe("PENDING");
  });

  it("revokes the challenge when delivery fails", async () => {
    await seedStaff();
    const sender = {
      mode: "memory" as const,
      captured: () => [],
      async send() {
        throw new Error("smtp down");
      },
    };
    await requestEmailVerification({
      email: "nimal@example.com",
      sender,
      allowlistedOrigin: ORIGIN,
    });
    const stored = await EmailVerificationChallenge.findOne();
    expect(stored?.revokedAt).toBeInstanceOf(Date);
  });

  it("returns the same acceptance for a missing account and stores nothing", async () => {
    const sender = createMemoryVerificationSender();
    const missing = await requestEmailVerification({
      email: "missing@example.com",
      sender,
      allowlistedOrigin: ORIGIN,
    });
    expect(missing).toEqual({ accepted: true });
    expect(sender.captured()).toHaveLength(0);
    expect(await EmailVerificationChallenge.countDocuments()).toBe(0);
  });

  it("fails closed in production without creating a challenge", async () => {
    await seedStaff();
    const sender = createUnavailableVerificationSender();
    const result = await requestEmailVerification({
      email: "nimal@example.com",
      sender,
      allowlistedOrigin: ORIGIN,
    });
    expect(result).toEqual({ accepted: true });
    expect(await EmailVerificationChallenge.countDocuments()).toBe(0);
  });

  it("builds links only from the allowlisted origin", () => {
    const link = verificationLink(ORIGIN, "a".repeat(43));
    expect(link.startsWith(`${ORIGIN}/verify-email#token=`)).toBe(true);
    expect(() => verificationLink("http://evil.example", "a".repeat(43))).toThrow(
      /https/,
    );
  });

  it("sends one message when two requests race", async () => {
    await seedStaff();
    const now = new Date();
    const senders = [createMemoryVerificationSender(), createMemoryVerificationSender()];
    await Promise.all(
      senders.map((sender) =>
        requestEmailVerification({
          email: "nimal@example.com",
          sender,
          allowlistedOrigin: ORIGIN,
          now,
        }),
      ),
    );
    expect(senders.flatMap((sender) => sender.captured())).toHaveLength(1);
    expect(
      await EmailVerificationChallenge.countDocuments({ usedAt: null, revokedAt: null }),
    ).toBe(1);
  });

  it("keeps the previous token when a resend cannot be stored", async () => {
    await seedStaff();
    const issuedAt = new Date("2026-02-01T00:00:00.000Z");
    const resentAt = new Date(issuedAt.getTime() + RESEND_COOLDOWN_MS);
    const first = await issue("nimal@example.com", issuedAt);
    const spy = vi
      .spyOn(EmailVerificationChallenge, "create")
      .mockRejectedValueOnce(new Error("mongodb://secret"));
    const sender = createMemoryVerificationSender();
    await expect(
      requestEmailVerification({
        email: "nimal@example.com",
        sender,
        allowlistedOrigin: ORIGIN,
        now: resentAt,
      }),
    ).rejects.toBeInstanceOf(VerificationDependencyError);
    spy.mockRestore();
    expect(sender.captured()).toHaveLength(0);
    expect((await consumeEmailVerification({ token: first.token, now: resentAt })).ok).toBe(true);
  });

  it("lets exactly one concurrent consume succeed", async () => {
    await seedStaff();
    const { token } = await issue();
    const results = await Promise.all([
      consumeEmailVerification({ token }),
      consumeEmailVerification({ token }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await User.findOne())?.emailVerified).toBe(true);
    expect((await User.findOne())?.status).toBe("PENDING");
  });

  it("restores the challenge when the user update fails", async () => {
    await seedStaff();
    const { token } = await issue();
    const spy = vi.spyOn(User, "updateOne").mockRejectedValueOnce(new Error("mongodb://secret"));
    await expect(consumeEmailVerification({ token })).rejects.toBeInstanceOf(
      VerificationDependencyError,
    );
    spy.mockRestore();
    const stored = await EmailVerificationChallenge.findOne();
    expect(stored?.usedAt).toBeNull();
    expect((await User.findOne())?.emailVerified).toBe(false);
    await expect(consumeEmailVerification({ token })).resolves.toMatchObject({ ok: true });
  });

  it("keeps HTTP responses generic and ignores forged return targets", async () => {
    await seedStaff();
    const app = createApp();
    const known = await request(app)
      .post("/api/v1/auth/verification/request")
      .set("Origin", ORIGIN)
      .send({ email: "nimal@example.com" });
    const unknown = await request(app)
      .post("/api/v1/auth/verification/request")
      .set("Origin", ORIGIN)
      .send({ email: "missing@example.com" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data).toEqual(unknown.body.data);
    expect(JSON.stringify(known.body)).not.toMatch(/token|password|nimal@/i);
    expect(known.headers["set-cookie"]).toBeUndefined();
    expect(known.headers["referrer-policy"]).toBe("no-referrer");

    const forged = await request(app)
      .post("/api/v1/auth/verify-email")
      .set("Origin", "https://evil.example")
      .set("Host", "evil.example")
      .send({ token: "a".repeat(43), returnTo: "https://evil.example/phish" });
    expect(forged.status).toBe(403);

    const redirected = await request(app)
      .post("/api/v1/auth/verify-email")
      .set("Origin", ORIGIN)
      .send({ token: "a".repeat(43), returnTo: "https://evil.example/phish" });
    expect(redirected.status).toBe(400);
    expect(redirected.body.error.message).toBe("verification could not be completed");
    expect((await User.findOne())?.emailVerified).toBe(false);

    const getConsume = await request(app).get("/api/v1/auth/verify-email");
    expect(getConsume.status).toBe(404);
    expect(getConsume.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});
