import { compare, hash } from "bcryptjs";

import { logger } from "../../../shared/logger.js";
import { RegistrationRequest } from "../models/registration-request.model.js";
import { User } from "../models/user.model.js";
import { BCRYPT_COST } from "../registration.service.js";
import { authNow } from "./auth.clock.js";
import { AuthDependencyError } from "./auth.errors.js";
import { persistInitialRefreshSession } from "./refresh-session.service.js";
import type { IssuedRefreshSession } from "./auth.types.js";

export class AccountPendingApprovalError extends Error {
  readonly code = "ACCOUNT_PENDING_APPROVAL" as const;
  constructor(
    message = "Your registration is currently pending administrator approval. You will receive an email once your account has been reviewed.",
  ) {
    super(message);
    this.name = "AccountPendingApprovalError";
  }
}

export class AccountRejectedError extends Error {
  readonly code = "ACCOUNT_REJECTED" as const;
  constructor(
    message = "Your registration request was not approved. Please contact your organization administrator.",
  ) {
    super(message);
    this.name = "AccountRejectedError";
  }
}

export class AccountSuspendedError extends Error {
  readonly code = "ACCOUNT_SUSPENDED" as const;
  constructor(message = "Your account has been suspended. Please contact your administrator.") {
    super(message);
    this.name = "AccountSuspendedError";
  }
}

let timingPad: Promise<string> | null = null;

function timingPadHash(): Promise<string> {
  timingPad ??= hash("infraos-auth-timing-pad", BCRYPT_COST);
  return timingPad;
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
  userAgent?: string;
  requestId: string;
}): Promise<IssuedRefreshSession | null> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

  if (!user) {
    const regReq = await RegistrationRequest.findOne({ email: normalizedEmail }).select("+passwordHash");
    if (regReq?.passwordHash) {
      let regPasswordMatches = false;
      try {
        regPasswordMatches = await compare(input.password, regReq.passwordHash);
      } catch {
        regPasswordMatches = false;
      }
      if (regPasswordMatches) {
        if (regReq.status === "PENDING") {
          throw new AccountPendingApprovalError();
        }
        if (regReq.status === "REJECTED") {
          throw new AccountRejectedError();
        }
      }
    }
  }

  const hashToCompare = user?.passwordHash ?? (await timingPadHash());
  let passwordMatches = false;
  try {
    passwordMatches = await compare(input.password, hashToCompare);
  } catch {
    passwordMatches = false;
  }
  if (!user || !passwordMatches || !user.passwordHash) {
    logger.warn(
      { requestId: input.requestId, outcome: "denied" },
      "login denied",
    );
    return null;
  }

  // If user originated from a registration request and is still PENDING or REJECTED:
  if (user.status === "PENDING" && (user as any).registrationRequestId) {
    throw new AccountPendingApprovalError();
  }
  if ((user.status as string) === "REJECTED" && (user as any).registrationRequestId) {
    throw new AccountRejectedError();
  }

  const fresh = await User.findById(user._id);
  if (!fresh) return null;
  let issued: IssuedRefreshSession | null;
  try {
    issued = await persistInitialRefreshSession({
      user: fresh,
      userAgent: input.userAgent,
      verifiedPasswordHash: user.passwordHash,
    });
  } catch (error) {
    if (error instanceof AuthDependencyError) throw error;
    throw new AuthDependencyError();
  }
  if (!issued) {
    logger.warn(
      { requestId: input.requestId, outcome: "denied", userId: fresh._id.toString() },
      "login denied",
    );
    return null;
  }

  try {
    await User.updateOne({ _id: fresh._id }, { $set: { lastLoginAt: authNow() } });
  } catch {
    logger.warn(
      { requestId: input.requestId, outcome: "telemetry_failed", userId: fresh._id.toString() },
      "lastLoginAt was not updated",
    );
  }
  logger.info(
    { requestId: input.requestId, outcome: "accepted", userId: fresh._id.toString() },
    "login accepted",
  );
  return issued;
}
