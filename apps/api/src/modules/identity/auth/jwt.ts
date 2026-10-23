import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import mongoose from "mongoose";

import { env } from "../../../config/env.js";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_MAX_SECONDS,
} from "./auth.constants.js";
import { AuthDependencyError } from "./auth.errors.js";
import { authNow } from "./auth.clock.js";

export type AccessTokenClaims = {
  sub: string;
  jti: string;
  exp: number;
};

function durationSeconds(
  raw: string | undefined,
  fallback: number,
  max: number,
): number {
  if (!raw) return fallback;
  const match = /^(\d+)([smhd])?$/.exec(raw.trim());
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const multiplier =
    unit === "m" ? 60 : unit === "h" ? 3600 : unit === "d" ? 86400 : 1;
  const seconds = amount * multiplier;
  if (!Number.isFinite(seconds) || seconds < 60) return fallback;
  return Math.min(seconds, max);
}

export function accessTokenTtlSeconds(): number {
  return durationSeconds(
    env.ACCESS_TOKEN_TTL,
    ACCESS_TOKEN_MAX_SECONDS,
    ACCESS_TOKEN_MAX_SECONDS,
  );
}

export function refreshAbsoluteTtlSeconds(): number {
  return durationSeconds(
    env.REFRESH_TOKEN_TTL,
    7 * 24 * 60 * 60,
    7 * 24 * 60 * 60,
  );
}

export function secretBytes(
  name: "ACCESS_TOKEN_SECRET" | "REFRESH_TOKEN_SECRET",
): Uint8Array {
  const value =
    name === "ACCESS_TOKEN_SECRET"
      ? env.ACCESS_TOKEN_SECRET
      : env.REFRESH_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new AuthDependencyError();
  }
  return new TextEncoder().encode(value);
}

export function assertAuthInfrastructure(): void {
  assertAuthSecretsReady();
  if (mongoose.connection.readyState !== 1) {
    throw new AuthDependencyError();
  }
}

export function assertAuthSecretsReady(): void {
  const access = env.ACCESS_TOKEN_SECRET;
  const refresh = env.REFRESH_TOKEN_SECRET;
  if (!access || !refresh || access.length < 32 || refresh.length < 32) {
    throw new AuthDependencyError();
  }
  const left = createHash("sha256").update(access).digest();
  const right = createHash("sha256").update(refresh).digest();
  if (timingSafeEqual(left, right)) {
    throw new AuthDependencyError();
  }
}

export async function signAccessToken(userId: string): Promise<{
  token: string;
  expiresInSeconds: number;
}> {
  assertAuthSecretsReady();
  const ttl = accessTokenTtlSeconds();
  const now = authNow();
  const token = await new SignJWT({ typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ACCESS_TOKEN_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE)
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + ttl)
    .sign(secretBytes("ACCESS_TOKEN_SECRET"));
  return { token, expiresInSeconds: ttl };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  assertAuthSecretsReady();
  const nowSeconds = Math.floor(authNow().getTime() / 1000);
  const { payload, protectedHeader } = await jwtVerify(
    token,
    secretBytes("ACCESS_TOKEN_SECRET"),
    {
      algorithms: ["HS256"],
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      clockTolerance: 5,
      currentDate: authNow(),
    },
  );
  if (protectedHeader.alg !== "HS256") {
    throw new Error("unexpected jwt algorithm");
  }
  if (payload.typ !== "access") {
    throw new Error("unexpected jwt type");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("missing jwt subject");
  }
  if (typeof payload.jti !== "string" || payload.jti.length === 0) {
    throw new Error("missing jwt id");
  }
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
    throw new Error("missing jwt time claims");
  }
  if (payload.iat > nowSeconds + 60) {
    throw new Error("jwt issued in the future");
  }
  return { sub: payload.sub, jti: payload.jti, exp: payload.exp };
}
