import { clearAuthSession, setAuthenticated, setAuthError, setAuthenticating } from "./state";
import type { AuthLoginResult, AuthTransport, LoginRequest } from "./types";
import { resolveAuthTransport } from "./transport";

export async function loginWithAuthClient(
  input: LoginRequest,
  transport?: AuthTransport,
): Promise<AuthLoginResult> {
  setAuthenticating();
  const result = await resolveAuthTransport(transport).login(input);
  if (result.ok) {
    setAuthenticated(result.session);
    return result;
  }
  setAuthError();
  clearAuthSession();
  return result;
}
