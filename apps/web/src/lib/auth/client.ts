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
