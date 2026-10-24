import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import { Agency } from "../../agencies/models/agency.model.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";
import { failure } from "../../../shared/http/envelope.js";
import { logger } from "../../../shared/logger.js";
import type { AuthUserDto } from "./auth.types.js";
import { AuthDependencyError } from "./auth.errors.js";
import { accessTokenFailureCode, assertAuthSecretsReady, verifyAccessToken } from "./jwt.js";

/**
 * Step 45 permission checks are a separate middleware. This middleware proves
 * identity only. It does not read a permissions array or role claim from the JWT.
 * 403 FORBIDDEN is reserved for a later authenticated-but-unauthorized decision.
 */
export type AuthenticatedActor = {
  userId: string;
  roleId: string;
  roleKey: string;
  agencyId: string;
  credentialEpoch: number;
};

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function reject(res: Response, req: Request, status: 401 | 503, code: string): void {
  noStore(res);
  const message =
    status === 503
      ? "sign-in is temporarily unavailable"
      : "sign-in is required";
  res.status(status).json(failure(code, message, req.requestId));
}

/** One exact `Bearer <token>`. Rejects Basic, empty, duplicate, and comma-joined values. */
export function readSingleBearer(header: string | undefined): string | null {
  if (!header || header.includes(",")) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match?.[1]) return null;
  return match[1];
}

function isObjectId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

export async function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    noStore(res);
    const token = readSingleBearer(req.header("authorization"));
    if (!token) {
      reject(res, req, 401, "AUTH_REQUIRED");
      return;
    }
    assertAuthSecretsReady();
    if (mongoose.connection.readyState !== 1) {
      throw new AuthDependencyError();
    }
    let claims;
    try {
      claims = await verifyAccessToken(token);
    } catch (error) {
      reject(res, req, 401, accessTokenFailureCode(error));
      return;
    }
    if (!isObjectId(claims.sub)) {
      reject(res, req, 401, "AUTH_REQUIRED");
      return;
    }
    const user = await User.findById(claims.sub);
    if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || !user.agencyId) {
      reject(res, req, 401, "AUTH_REQUIRED");
      return;
    }
    const storedEpoch = user.credentialEpoch ?? 0;
    if (claims.credentialEpoch !== storedEpoch) {
      reject(res, req, 401, "SESSION_EXPIRED");
      return;
    }
    const [role, agency] = await Promise.all([
      Role.findById(user.roleId),
      Agency.findById(user.agencyId),
    ]);
    if (!role?.isActive || !agency || agency.status !== "ACTIVE") {
      reject(res, req, 401, "AUTH_REQUIRED");
      return;
    }
    const actor: AuthenticatedActor = {
      userId: user._id.toString(),
      roleId: role._id.toString(),
      roleKey: role.key,
      agencyId: agency._id.toString(),
      credentialEpoch: storedEpoch,
    };
    const authUser: AuthUserDto = {
      id: actor.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      email: user.email,
      roleKey: role.key,
      agencyId: actor.agencyId,
      status: "ACTIVE",
      emailVerified: true,
    };
    req.actor = actor;
    req.authUser = authUser;
    next();
  } catch (error) {
    if (error instanceof AuthDependencyError) {
      reject(res, req, 503, "SERVICE_UNAVAILABLE");
      return;
    }
    logger.warn({ requestId: req.requestId }, "authenticated actor lookup failed");
    reject(res, req, 503, "SERVICE_UNAVAILABLE");
  }
}
