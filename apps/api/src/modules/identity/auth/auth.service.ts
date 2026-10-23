import { compare, hash } from "bcryptjs";

import { logger } from "../../../shared/logger.js";
import { User } from "../models/user.model.js";
import { BCRYPT_COST } from "../registration.service.js";
import { authNow } from "./auth.clock.js";
import { AuthDependencyError } from "./auth.errors.js";
import { persistInitialRefreshSession } from "./refresh-session.service.js";
import type { IssuedRefreshSession } from "./auth.types.js";

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
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
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

  const fresh = await User.findById(user._id);
  if (!fresh) return null;
  let issued: IssuedRefreshSession | null;
  try {
    issued = await persistInitialRefreshSession({
      user: fresh,
      userAgent: input.userAgent,
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
