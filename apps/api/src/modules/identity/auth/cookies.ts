import type { Request, Response } from "express";

import { AUTH_COOKIE_PATH, REFRESH_COOKIE_NAME } from "./auth.constants.js";

const COOKIE_FLAGS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: AUTH_COOKIE_PATH,
};

export function readRefreshCookie(req: Request): string | null {
  const header = req.header("cookie");
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== REFRESH_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    if (!value || value.length > 200) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
  now: Date,
): void {
  const maxAge = expiresAt.getTime() - now.getTime();
  if (maxAge <= 0) {
    throw new Error("refresh cookie expiry is not in the future");
  }
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...COOKIE_FLAGS,
    maxAge,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_FLAGS);
}
