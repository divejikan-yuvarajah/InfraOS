import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { assertAuthSecretsReady, secretBytes } from "./jwt.js";

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  assertAuthSecretsReady();
  return createHmac("sha256", secretBytes("REFRESH_TOKEN_SECRET"))
    .update(token)
    .digest("base64url");
}

export function refreshTokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
