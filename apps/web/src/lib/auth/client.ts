import { ApiError, apiClient } from "@/lib/api/client";

import {
  beginLogoutEpoch,
  clearAuthSession,
  getAuthEpoch,
  setAuthError,
  setAuthenticated,
  setAuthenticating,
} from "./state";
import type { AuthLoginResult, AuthTransport, LoginRequest, LogoutOutcome } from "./types";
import { resolveAuthTransport } from "./transport";

export async function loginWithAuthClient(
  input: LoginRequest,
  transport?: AuthTransport,
): Promise<AuthLoginResult> {
  const atEpoch = getAuthEpoch();
  setAuthenticating();
  const result = await resolveAuthTransport(transport).login(input);
  if (atEpoch !== getAuthEpoch()) {
    return {
      ok: false,
      code: "SESSION_EXPIRED",
      message: "Your session has ended. Sign in again.",
    };
  }
  if (result.ok) {
    setAuthenticated(result.session);
    return result;
  }
  setAuthError();
  clearAuthSession();
  return result;
}

export async function logoutWithAuthClient(
  transport?: AuthTransport,
): Promise<LogoutOutcome> {
  beginLogoutEpoch();
  const logout = resolveAuthTransport(transport).logout;
  if (!logout) return "unconfirmed";
  try {
    return await logout();
  } catch {
    return "unconfirmed";
  }
}

export type ForgotPasswordOutcome = "accepted" | "unavailable" | "rejected";
export type ResetPasswordOutcome = "reset" | "unavailable" | "rejected";

export async function resetPasswordWithAuthClient(input: {
  token: string;
  password: string;
}): Promise<ResetPasswordOutcome> {
  try {
    const payload = await apiClient<{ data?: { status?: string } }>(
      "/api/v1/auth/reset-password",
      {
        method: "POST",
        credentials: "include",
        body: { token: input.token, password: input.password },
      },
    );
    return payload.data?.status === "RESET" ? "reset" : "rejected";
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) return "unavailable";
    return "rejected";
  }
}

/** Generic request. Does not reveal whether the address exists. */
export async function requestForgotPassword(email: string): Promise<ForgotPasswordOutcome> {
  try {
    const payload = await apiClient<{ data?: { status?: string } }>(
      "/api/v1/auth/forgot-password",
      {
        method: "POST",
        credentials: "include",
        body: { email },
      },
    );
    return payload.data?.status === "ACCEPTED" ? "accepted" : "rejected";
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) return "unavailable";
    return "rejected";
  }
}
