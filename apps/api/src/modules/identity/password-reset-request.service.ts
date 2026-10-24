import { createHash, randomBytes } from "node:crypto";

import { Agency } from "../agencies/models/agency.model.js";
import { mapMongoDuplicateField } from "../../shared/errors/mongo-duplicate.js";
import { PasswordResetChallenge } from "./models/password-reset-challenge.model.js";
import { Role } from "./models/role.model.js";
import { User, type UserDocument } from "./models/user.model.js";
import {
  passwordResetLink,
  type PasswordResetEmailSender,
} from "./password-reset-mail.js";

/** Matches the email-verification challenge lifetime. */
export const RESET_TTL_MS = 30 * 60 * 1000;
export const RESET_COOLDOWN_MS = 60 * 1000;

/**
 * Policy A — same gate as sign-in (`accountCanSignIn`).
 * Recovery never changes status, emailVerified, role, or agency.
 */
export const PASSWORD_RESET_ELIGIBILITY = "SIGN_IN_EQUIVALENT" as const;

export class PasswordResetDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("password reset could not be stored");
    this.name = "PasswordResetDependencyError";
  }
}

export type PasswordResetRequestResult = { accepted: true };

export type PasswordResetAuditEvent = {
  category:
    | "reset.requested"
    | "reset.issued"
    | "reset.delivery_unavailable"
    | "reset.rejected";
  requestId: string | null;
  userId: string | null;
};

const MAX_AUDIT_EVENTS = 200;
const auditEvents: PasswordResetAuditEvent[] = [];

export function passwordResetAuditEvents(): readonly PasswordResetAuditEvent[] {
  return auditEvents;
}

export function resetPasswordResetAuditForTests(): void {
  auditEvents.length = 0;
}

function audit(event: PasswordResetAuditEvent): void {
  auditEvents.push(event);
  if (auditEvents.length > MAX_AUDIT_EVENTS) {
    auditEvents.shift();
  }
}

export function digestResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Test barriers. Production leaves these as no-ops. */
export const passwordResetIssuanceHooks: {
  afterRevokeLive: () => Promise<void>;
  beforeInsert: () => Promise<void>;
} = {
  afterRevokeLive: async () => {},
  beforeInsert: async () => {},
};

export function resetPasswordResetIssuanceHooks(): void {
  passwordResetIssuanceHooks.afterRevokeLive = async () => {};
  passwordResetIssuanceHooks.beforeInsert = async () => {};
}

async function recoveryEligible(user: UserDocument): Promise<boolean> {
  if (user.status !== "ACTIVE" || user.emailVerified !== true) return false;
  if (!user.agencyId) return false;
  const [role, agency] = await Promise.all([
    Role.findById(user.roleId),
    Agency.findById(user.agencyId),
  ]);
  if (!role?.isActive) return false;
  if (!agency || agency.status !== "ACTIVE") return false;
  return true;
}

export async function requestPasswordReset(input: {
  email: string;
  sender: PasswordResetEmailSender;
  allowlistedOrigin: string;
  now?: Date;
  requestId?: string | null;
}): Promise<PasswordResetRequestResult> {
  const now = input.now ?? new Date();
  const requestId = input.requestId ?? null;
  const accepted = { accepted: true as const };
  audit({ category: "reset.requested", requestId, userId: null });
  if (input.sender.mode === "unavailable") {
    audit({ category: "reset.delivery_unavailable", requestId, userId: null });
    return accepted;
  }

  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email });
  if (!user || !(await recoveryEligible(user))) {
    return accepted;
  }

  const latest = await PasswordResetChallenge.findOne({
    userId: user._id,
    purpose: "RESET_PASSWORD",
  }).sort({ issuedAt: -1 });
  if (latest && now.getTime() - latest.issuedAt.getTime() < RESET_COOLDOWN_MS) {
    return accepted;
  }

  const live = await PasswordResetChallenge.findOne({
    userId: user._id,
    purpose: "RESET_PASSWORD",
    consumedAt: null,
    revokedAt: null,
  });
  let revokedId: typeof user._id | null = null;
  if (live) {
    const revoked = await PasswordResetChallenge.findOneAndUpdate(
      { _id: live._id, consumedAt: null, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    if (!revoked) {
      return accepted;
    }
    revokedId = live._id;
    await passwordResetIssuanceHooks.afterRevokeLive();
  }

  await passwordResetIssuanceHooks.beforeInsert();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = digestResetToken(token);
  try {
    await PasswordResetChallenge.create({
      userId: user._id,
      email: user.email,
      purpose: "RESET_PASSWORD",
      tokenHash,
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      issuedAt: now,
    });
  } catch (error) {
    if (mapMongoDuplicateField(error)) {
      return accepted;
    }
    if (revokedId) {
      try {
        await PasswordResetChallenge.updateOne(
          { _id: revokedId, consumedAt: null, revokedAt: now },
          { $set: { revokedAt: null } },
        );
      } catch {
        // The other request kept the live challenge.
      }
    }
    throw new PasswordResetDependencyError();
  }

  try {
    const link = passwordResetLink(input.allowlistedOrigin, token);
    await input.sender.send({ to: user.email, token, link });
  } catch {
    await PasswordResetChallenge.updateOne({ tokenHash }, { $set: { revokedAt: now } });
    if (revokedId) {
      await PasswordResetChallenge.updateOne(
        { _id: revokedId, consumedAt: null, revokedAt: now },
        { $set: { revokedAt: null } },
      );
    }
    audit({
      category: "reset.rejected",
      requestId,
      userId: user._id.toString(),
    });
    return accepted;
  }

  audit({
    category: "reset.issued",
    requestId,
    userId: user._id.toString(),
  });
  return accepted;
}
