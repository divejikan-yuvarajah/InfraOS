import type { AuthClientPhase, AuthSessionResponse } from "./types";

type MemoryAuthState = {
  phase: AuthClientPhase;
  session: AuthSessionResponse | null;
};

const memory: MemoryAuthState = {
  phase: "unauthenticated",
  session: null,
};

let epoch = 0;

export function getAuthEpoch(): number {
  return epoch;
}

/** Drop the in-memory token and ignore any login or refresh that started earlier. */
export function beginLogoutEpoch(): number {
  epoch += 1;
  memory.session = null;
  memory.phase = "unauthenticated";
  return epoch;
}

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

export function setRefreshing(): void {
  memory.phase = "refreshing";
}

export function setAuthenticated(session: AuthSessionResponse): void {
  memory.session = session;
  memory.phase = "authenticated";
}

export function applyAuthenticated(session: AuthSessionResponse, atEpoch: number): boolean {
  if (atEpoch !== epoch) return false;
  setAuthenticated(session);
  return true;
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
  epoch = 0;
}
