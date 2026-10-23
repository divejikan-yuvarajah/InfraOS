import { randomUUID } from "node:crypto";

import { Agency } from "../../agencies/models/agency.model.js";
import { RefreshFamily } from "../models/refresh-family.model.js";
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
export type LogoutResult = "revoked" | "absent" | "unavailable";

/** Test barriers. Production leaves these as no-ops. */
export const refreshRotationHooks: {
  afterClaim: () => Promise<void>;
  afterAuthoritySwap: () => Promise<void>;
} = {
  afterClaim: async () => {},
  afterAuthoritySwap: async () => {},
};

export function resetRefreshRotationHooks(): void {
  refreshRotationHooks.afterClaim = async () => {};
  refreshRotationHooks.afterAuthoritySwap = async () => {};
}

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
  const tokenHash = hashRefreshToken(refreshToken);
  const familyId = randomUUID();
  const expiresAt = new Date(now.getTime() + refreshAbsoluteTtlSeconds() * 1000);
  let createdId: string | null = null;
  let familyCreated = false;
  try {
    const created = await RefreshSession.create({
      userId: input.user._id,
      tokenHash,
      familyId,
      expiresAt,
      userAgentSummary: summarizeUserAgent(input.userAgent),
    });
    createdId = created._id.toString();
    await RefreshFamily.create({
      familyId,
      userId: input.user._id,
      expiresAt,
      closedAt: null,
      activeTokenHash: tokenHash,
    });
    familyCreated = true;
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
    if (familyCreated) {
      await RefreshFamily.updateOne(
        { familyId, closedAt: null },
        { $set: { closedAt: now, activeTokenHash: null } },
      );
    }
    if (error instanceof AuthDependencyError) throw error;
    throw new AuthDependencyError();
  }
}

async function closeFamily(familyId: string, now: Date): Promise<boolean> {
  const closed = await RefreshFamily.findOneAndUpdate(
    { familyId, closedAt: null },
    { $set: { closedAt: now, activeTokenHash: null } },
  );
  if (!closed) {
    const existing = await RefreshFamily.findOne({ familyId });
    if (!existing?.closedAt) return false;
  }
  await RefreshSession.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: now } },
  );
  return true;
}

async function restoreHashIfStillOpen(
  familyId: string,
  nextHash: string,
  previousHash: string,
): Promise<boolean> {
  const restored = await RefreshFamily.findOneAndUpdate(
    { familyId, closedAt: null, activeTokenHash: nextHash },
    { $set: { activeTokenHash: previousHash } },
  );
  return Boolean(restored);
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
    const closed = await closeFamily(claimed.familyId, now);
    return { ok: false, reason: closed ? "unauthorized" : "unavailable" };
  }

  await refreshRotationHooks.afterClaim();

  const refreshToken = generateRefreshToken();
  const nextHash = hashRefreshToken(refreshToken);
  const swapped = await RefreshFamily.findOneAndUpdate(
    {
      familyId: claimed.familyId,
      closedAt: null,
      activeTokenHash: tokenHash,
    },
    { $set: { activeTokenHash: nextHash } },
  );
  if (!swapped) {
    return { ok: false, reason: "unauthorized" };
  }

  await refreshRotationHooks.afterAuthoritySwap();

  let successorId: string | null = null;
  try {
    const successor = await RefreshSession.create({
      userId: claimed.userId,
      tokenHash: nextHash,
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
    const stillCurrent = await RefreshFamily.findOne({
      familyId: claimed.familyId,
      closedAt: null,
      activeTokenHash: nextHash,
    }).select("+activeTokenHash");
    if (!stillCurrent) {
      await RefreshSession.updateOne(
        { _id: successor._id },
        { $set: { revokedAt: now } },
      );
      return { ok: false, reason: "unauthorized" };
    }
  } catch (error) {
    if (successorId) {
      await RefreshSession.updateOne(
        { _id: successorId },
        { $set: { revokedAt: now } },
      );
    }
    const restored = await restoreHashIfStillOpen(
      claimed.familyId,
      nextHash,
      tokenHash,
    );
    if (restored) {
      await RefreshSession.updateOne(
        { _id: claimed._id, replacedBySessionId: null },
        { $set: { revokedAt: null, lastUsedAt: null } },
      );
    }
    if (error instanceof AuthDependencyError && !restored) {
      return { ok: false, reason: "unauthorized" };
    }
    return { ok: false, reason: restored ? "unavailable" : "unauthorized" };
  }

  try {
    const session = await issueAccessSession(user);
    if (!session) {
      await closeFamily(claimed.familyId, now);
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
    await closeFamily(claimed.familyId, now);
    return { ok: false, reason: "unavailable" };
  }
}

export async function logoutRefreshFamily(
  refreshToken: string | null,
): Promise<LogoutResult> {
  if (!refreshToken) return "absent";
  let tokenHash: string;
  try {
    tokenHash = hashRefreshToken(refreshToken);
  } catch (error) {
    if (error instanceof AuthDependencyError) return "unavailable";
    return "absent";
  }
  const existing = await RefreshSession.findOne({ tokenHash }).select("+tokenHash");
  if (!existing) return "absent";
  try {
    const closed = await closeFamily(existing.familyId, authNow());
    return closed ? "revoked" : "unavailable";
  } catch {
    return "unavailable";
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
  const family = await RefreshFamily.findOne({ familyId: existing.familyId });
  if (family?.closedAt) {
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
      const closed = await closeFamily(existing.familyId, now);
      if (!closed) return { ok: false, reason: "unavailable" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }
  return { ok: false, reason: "unauthorized" };
}
