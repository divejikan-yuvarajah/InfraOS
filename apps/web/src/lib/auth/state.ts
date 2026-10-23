import type { AuthClientPhase, AuthSessionResponse } from "./types";

type MemoryAuthState = {
  phase: AuthClientPhase;
  session: AuthSessionResponse | null;
};

const memory: MemoryAuthState = {
  phase: "unauthenticated",
  session: null,
};

export function getAuthPhase(): AuthClientPhase {
  return memory.phase;
}

export function getMemoryAccessToken(): string | null {
  return memory.session?.accessToken ?? null;
}

export function getMemorySession(): AuthSessionResponse | null {
  return memory.session;
}

export function setAuthenticating(): void {
  memory.phase = "authenticating";
}

export function setAuthenticated(session: AuthSessionResponse): void {
  memory.session = session;
  memory.phase = "authenticated";
}

export function setAuthError(): void {
  memory.phase = "error";
}

export function clearAuthSession(): void {
  memory.session = null;
  memory.phase = "unauthenticated";
}

/** Test-only reset. */
export function resetAuthMemoryForTests(): void {
  memory.phase = "unauthenticated";
  memory.session = null;
}
