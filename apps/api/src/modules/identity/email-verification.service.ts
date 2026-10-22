import { createHash, randomBytes } from "node:crypto";

import { mapMongoDuplicateField } from "../../shared/errors/mongo-duplicate.js";
import { User } from "./models/user.model.js";
import { EmailVerificationChallenge } from "./models/email-verification-challenge.model.js";
import {
  verificationLink,
  type VerificationEmailSender,
} from "./verification-mail.js";

export const VERIFICATION_TTL_MS = 30 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export class VerificationDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("verification could not be stored");
    this.name = "VerificationDependencyError";
  }
}

export type VerificationRequestResult = {
  accepted: true;
};

export type VerificationConsumeResult =
  | { ok: true; userId: string }
  | { ok: false };

export type VerificationAuditEvent = {
  category:
    | "verification.requested"
    | "verification.issued"
    | "verification.delivery_unavailable"
    | "verification.consumed"
    | "verification.rejected";
  requestId: string | null;
  userId: string | null;
};

const MAX_AUDIT_EVENTS = 200;
const auditEvents: VerificationAuditEvent[] = [];

export function verificationAuditEvents(): readonly VerificationAuditEvent[] {
  return auditEvents;
}

function audit(event: VerificationAuditEvent): void {
  auditEvents.push(event);
  if (auditEvents.length > MAX_AUDIT_EVENTS) {
    auditEvents.shift();
  }
}

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function requestEmailVerification(input: {
  email: string;
  sender: VerificationEmailSender;
  allowlistedOrigin: string;
  now?: Date;
  requestId?: string | null;
}): Promise<VerificationRequestResult> {
  const now = input.now ?? new Date();
  const requestId = input.requestId ?? null;
  const accepted = { accepted: true as const };
  audit({ category: "verification.requested", requestId, userId: null });
  if (input.sender.mode === "unavailable") {
    audit({ category: "verification.delivery_unavailable", requestId, userId: null });
    return accepted;
  }
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({
    email,
    emailVerified: false,
    status: "PENDING",
  });
  if (!user) {
    return accepted;
  }
  const latest = await EmailVerificationChallenge.findOne({
    userId: user._id,
    purpose: "VERIFY_EMAIL",
  }).sort({ issuedAt: -1 });
  if (latest && now.getTime() - latest.issuedAt.getTime() < RESEND_COOLDOWN_MS) {
    return accepted;
  }
  const live = await EmailVerificationChallenge.findOne({
    userId: user._id,
    purpose: "VERIFY_EMAIL",
    usedAt: null,
    revokedAt: null,
  });
  let revokedId: typeof user._id | null = null;
  if (live) {
    const revoked = await EmailVerificationChallenge.findOneAndUpdate(
      { _id: live._id, usedAt: null, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    if (!revoked) {
      return accepted;
    }
    revokedId = live._id;
  }
  const token = randomBytes(32).toString("base64url");
  const tokenHash = digest(token);
  try {
    await EmailVerificationChallenge.create({
      userId: user._id,
      email: user.email,
      purpose: "VERIFY_EMAIL",
      tokenHash,
      expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
      issuedAt: now,
    });
  } catch (error) {
    if (mapMongoDuplicateField(error)) {
      return accepted;
    }
    if (revokedId) {
      try {
        await EmailVerificationChallenge.updateOne(
          { _id: revokedId, usedAt: null, revokedAt: now },
          { $set: { revokedAt: null } },
        );
      } catch {
        // The partial unique index kept the other request's live challenge.
      }
    }
    throw new VerificationDependencyError();
  }
  try {
    const link = verificationLink(input.allowlistedOrigin, token);
    await input.sender.send({ to: user.email, token, link });
  } catch (error) {
    await EmailVerificationChallenge.updateOne({ tokenHash }, { $set: { revokedAt: now } });
    if (error instanceof VerificationDependencyError) throw error;
    audit({
      category: "verification.rejected",
      requestId,
      userId: user._id.toString(),
    });
    return accepted;
  }
  audit({ category: "verification.issued", requestId, userId: user._id.toString() });
  return accepted;
}

export async function consumeEmailVerification(input: {
  token: string;
  now?: Date;
  requestId?: string | null;
}): Promise<VerificationConsumeResult> {
  const now = input.now ?? new Date();
  const requestId = input.requestId ?? null;
  if (!tokenShape(input.token)) {
    audit({ category: "verification.rejected", requestId, userId: null });
    return { ok: false };
  }
  const tokenHash = digest(input.token);
  const challenge = await EmailVerificationChallenge.findOne({ tokenHash }).select("+tokenHash");
  if (!challenge || challenge.purpose !== "VERIFY_EMAIL") {
    audit({ category: "verification.rejected", requestId, userId: null });
    return { ok: false };
  }
  if (challenge.usedAt || challenge.revokedAt || challenge.expiresAt.getTime() <= now.getTime()) {
    audit({
      category: "verification.rejected",
      requestId,
      userId: challenge.userId.toString(),
    });
    return { ok: false };
  }
  const user = await User.findById(challenge.userId);
  if (
    !user ||
    user.email !== challenge.email ||
    user.status === "DISABLED" ||
    user.status === "SUSPENDED"
  ) {
    audit({
      category: "verification.rejected",
      requestId,
      userId: challenge.userId.toString(),
    });
    return { ok: false };
  }

  const consumed = await EmailVerificationChallenge.findOneAndUpdate(
    {
      _id: challenge._id,
      usedAt: null,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { new: true },
  );
  if (!consumed) {
    audit({ category: "verification.rejected", requestId, userId: user._id.toString() });
    return { ok: false };
  }

  try {
    const updated = await User.updateOne(
      {
        _id: user._id,
        email: challenge.email,
        status: { $in: ["PENDING", "ACTIVE"] },
      },
      { $set: { emailVerified: true } },
    );
    if (updated.modifiedCount !== 1) {
      await EmailVerificationChallenge.updateOne({ _id: consumed._id }, { $set: { usedAt: null } });
      audit({ category: "verification.rejected", requestId, userId: user._id.toString() });
      return { ok: false };
    }
  } catch {
    await EmailVerificationChallenge.updateOne({ _id: consumed._id }, { $set: { usedAt: null } });
    throw new VerificationDependencyError();
  }

  audit({ category: "verification.consumed", requestId, userId: user._id.toString() });
  return { ok: true, userId: user._id.toString() };
}
