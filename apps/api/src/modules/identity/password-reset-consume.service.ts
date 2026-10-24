import { hash } from "bcryptjs";
import mongoose from "mongoose";

import { Agency } from "../agencies/models/agency.model.js";
import { PasswordResetChallenge } from "./models/password-reset-challenge.model.js";
import { RefreshFamily } from "./models/refresh-family.model.js";
import { RefreshSession } from "./models/refresh-session.model.js";
import { Role } from "./models/role.model.js";
import { User, type UserDocument } from "./models/user.model.js";
import { BCRYPT_COST } from "./registration.service.js";
import { BCRYPT_MAX_UTF8_BYTES, PASSWORD_MIN_LENGTH } from "./registration.schema.js";
import {
  digestResetToken,
  resetTokenShape,
} from "./password-reset-request.service.js";

export class PasswordResetDependencyError extends Error {
  readonly code = "SERVICE_UNAVAILABLE" as const;
  constructor() {
    super("password reset could not be stored");
    this.name = "PasswordResetDependencyError";
  }
}

class ResetRejected extends Error {
  constructor() {
    super("reset-rejected");
    this.name = "ResetRejected";
  }
}

export const passwordResetConsumeHooks: {
  beforeEpochWrite: () => Promise<void>;
} = {
  beforeEpochWrite: async () => {},
};

export function resetPasswordResetConsumeHooks(): void {
  passwordResetConsumeHooks.beforeEpochWrite = async () => {};
}

async function stillEligible(user: UserDocument): Promise<boolean> {
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

export async function consumePasswordReset(input: {
  token: string;
  password: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; reason: "rejected" | "unavailable" }> {
  if (!resetTokenShape(input.token)) return { ok: false, reason: "rejected" };
  if (
    input.password.length < PASSWORD_MIN_LENGTH ||
    Buffer.byteLength(input.password, "utf8") > BCRYPT_MAX_UTF8_BYTES
  ) {
    return { ok: false, reason: "rejected" };
  }
  const now = input.now ?? new Date();
  const tokenHash = digestResetToken(input.token);
  const passwordHash = await hash(input.password, BCRYPT_COST);
  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const challenge = await PasswordResetChallenge.findOneAndUpdate(
        {
          tokenHash,
          purpose: "RESET_PASSWORD",
          consumedAt: null,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { consumedAt: now } },
        { session: mongoSession, returnDocument: "after" },
      );
      if (!challenge) throw new ResetRejected();

      const user = await User.findById(challenge.userId)
        .select("+passwordHash")
        .session(mongoSession);
      if (!user || !(await stillEligible(user))) throw new ResetRejected();

      await passwordResetConsumeHooks.beforeEpochWrite();
      const epoch = user.credentialEpoch ?? 0;
      const epochMatch =
        epoch === 0
          ? { $or: [{ credentialEpoch: { $exists: false } }, { credentialEpoch: 0 }] }
          : { credentialEpoch: epoch };
      const written = await User.findOneAndUpdate(
        { _id: user._id, ...epochMatch },
        { $set: { passwordHash, credentialEpoch: epoch + 1 } },
        { session: mongoSession },
      );
      if (!written) throw new PasswordResetDependencyError();

      await RefreshFamily.updateMany(
        { userId: user._id },
        { $set: { closedAt: now, activeTokenHash: null } },
        { session: mongoSession },
      );
      await RefreshSession.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: now } },
        { session: mongoSession },
      );
      await PasswordResetChallenge.updateMany(
        {
          userId: user._id,
          purpose: "RESET_PASSWORD",
          _id: { $ne: challenge._id },
          consumedAt: null,
          revokedAt: null,
        },
        { $set: { revokedAt: now } },
        { session: mongoSession },
      );
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ResetRejected) return { ok: false, reason: "rejected" };
    if (error instanceof PasswordResetDependencyError) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "unavailable" };
  } finally {
    await mongoSession.endSession();
  }
}
