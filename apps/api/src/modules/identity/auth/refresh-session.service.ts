import { randomUUID } from "node:crypto";

import { Agency } from "../../agencies/models/agency.model.js";
import { RefreshSession } from "../models/refresh-session.model.js";
import { Role } from "../models/role.model.js";
import { User, type UserDocument } from "../models/user.model.js";
import { REFRESH_REUSE_GRACE_MS } from "./auth.constants.js";
import { authNow } from "./auth.clock.js";
import { AuthDependencyError } from "./auth.errors.js";
import { refreshAbsoluteTtlSeconds, signAccessToken } from "./jwt.js";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token.js";
import type { AuthSessionDto, AuthUserDto, IssuedRefreshSession } from "./auth.types.js";

export type RefreshFailure = "unauthorized" | "unavailable";

function summarizeUserAgent(value: string | undefined): string | null {
  if (!value) return null;
  let cleaned = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 && code !== 127) cleaned += char;
  }
  const trimmed = cleaned.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 180);
}

async function accountCanSignIn(user: UserDocument): Promise<boolean> {
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

async function toUserDto(user: UserDocument): Promise<AuthUserDto | null> {
  if (!(await accountCanSignIn(user))) return null;
  const role = await Role.findById(user.roleId);
  if (!role) return null;
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    email: user.email,
    roleKey: role.key,
    agencyId: user.agencyId ? user.agencyId.toString() : null,
    status: "ACTIVE",
    emailVerified: true,
  };
}

async function issueAccessSession(user: UserDocument): Promise<AuthSessionDto | null> {
  const dto = await toUserDto(user);
  if (!dto) return null;
  const access = await signAccessToken(dto.id);
  return {
    user: dto,
    accessToken: access.token,
    accessTokenExpiresInSeconds: access.expiresInSeconds,
  };
}

export async function persistInitialRefreshSession(input: {
  user: UserDocument;
  userAgent?: string;
}): Promise<IssuedRefreshSession | null> {
  const now = authNow();
  if (!(await accountCanSignIn(input.user))) return null;
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(now.getTime() + refreshAbsoluteTtlSeconds() * 1000);
  let createdId: string | null = null;
  try {
    const created = await RefreshSession.create({
      userId: input.user._id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: randomUUID(),
      expiresAt,
      userAgentSummary: summarizeUserAgent(input.userAgent),
    });
    createdId = created._id.toString();
    const sessionBody = await issueAccessSession(input.user);
    if (!sessionBody) {
      await RefreshSession.updateOne(
        { _id: created._id },
        { $set: { revokedAt: now } },
      );
      return null;
    }
    return {
      session: sessionBody,
      refreshToken,
      refreshExpiresAt: expiresAt,
    };
  } catch (error) {
    if (createdId) {
      await RefreshSession.updateOne(
        { _id: createdId },
        { $set: { revokedAt: now } },
      );
    }
    if (error instanceof AuthDependencyError) throw error;
    throw new AuthDependencyError();
  }
}

async function revokeFamily(familyId: string, now: Date): Promise<void> {
  await RefreshSession.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: now } },
  );
}

export async function rotateRefreshSession(input: {
  refreshToken: string;
  userAgent?: string;
}): Promise<
  | { ok: true; issued: IssuedRefreshSession }
  | { ok: false; reason: RefreshFailure }
> {
  const now = authNow();
  let tokenHash: string;
  try {
    tokenHash = hashRefreshToken(input.refreshToken);
  } catch (error) {
    if (error instanceof AuthDependencyError) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "unauthorized" };
  }

  const claimed = await RefreshSession.findOneAndUpdate(
    {
      tokenHash,
      revokedAt: null,
      replacedBySessionId: null,
      expiresAt: { $gt: now },
    },
    { $set: { revokedAt: now, lastUsedAt: now } },
    { returnDocument: "before" },
  );

  if (!claimed) {
    return classifyRejectedRefresh(tokenHash, now);
  }

  const user = await User.findById(claimed.userId);
  if (!user || !(await accountCanSignIn(user))) {
    await revokeFamily(claimed.familyId, now);
    return { ok: false, reason: "unauthorized" };
  }

  const refreshToken = generateRefreshToken();
  let successorId: string | null = null;
  try {
    const successor = await RefreshSession.create({
      userId: claimed.userId,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: claimed.familyId,
      expiresAt: claimed.expiresAt,
      userAgentSummary: summarizeUserAgent(input.userAgent),
    });
    successorId = successor._id.toString();
    const linked = await RefreshSession.updateOne(
      { _id: claimed._id, replacedBySessionId: null },
      { $set: { replacedBySessionId: successor._id } },
    );
    if (linked.modifiedCount !== 1) {
      throw new AuthDependencyError();
    }
  } catch {
    if (successorId) {
      await RefreshSession.updateOne(
        { _id: successorId },
        { $set: { revokedAt: now } },
      );
    }
    await RefreshSession.updateOne(
      { _id: claimed._id, replacedBySessionId: null },
      { $set: { revokedAt: null, lastUsedAt: null } },
    );
    return { ok: false, reason: "unavailable" };
  }

  try {
    const session = await issueAccessSession(user);
    if (!session) {
      await revokeFamily(claimed.familyId, now);
      return { ok: false, reason: "unauthorized" };
    }
    return {
      ok: true,
      issued: {
        session,
        refreshToken,
        refreshExpiresAt: claimed.expiresAt,
      },
    };
  } catch {
    await revokeFamily(claimed.familyId, now);
    return { ok: false, reason: "unavailable" };
  }
}

async function classifyRejectedRefresh(
  tokenHash: string,
  now: Date,
): Promise<{ ok: false; reason: RefreshFailure }> {
  const existing = await RefreshSession.findOne({ tokenHash }).select("+tokenHash");
  if (!existing) return { ok: false, reason: "unauthorized" };
  if (existing.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "unauthorized" };
  }
  const revokedAt = existing.revokedAt?.getTime() ?? null;
  const withinGrace =
    revokedAt !== null && now.getTime() - revokedAt <= REFRESH_REUSE_GRACE_MS;
  if (withinGrace) {
    return { ok: false, reason: "unauthorized" };
  }
  if (existing.revokedAt || existing.replacedBySessionId) {
    try {
      await revokeFamily(existing.familyId, now);
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }
  return { ok: false, reason: "unauthorized" };
}
