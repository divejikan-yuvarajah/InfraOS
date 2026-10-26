import { clearPrivateQueryCache } from "./query-cache";
import type { AuthPublicSnapshot } from "./route-access";
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
let bootSettled = false;
const listeners = new Set<() => void>();

const SERVER_SNAPSHOT: AuthPublicSnapshot = {
  phase: "unknown",
  authenticated: false,
  bootSettled: false,
  identityConfirmed: false,
};

let identityConfirmed = false;

let snapshot: AuthPublicSnapshot = {
  phase: "unauthenticated",
  authenticated: false,
  bootSettled: false,
  identityConfirmed: false,
};

function publish(): void {
  const authenticated = Boolean(memory.session?.accessToken);
  if (
    snapshot.phase === memory.phase &&
    snapshot.authenticated === authenticated &&
    snapshot.bootSettled === bootSettled &&
    snapshot.identityConfirmed === identityConfirmed
  ) {
    return;
  }
  snapshot = { phase: memory.phase, authenticated, bootSettled, identityConfirmed };
  for (const listener of listeners) listener();
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Client snapshot. The access token stays in module memory and is not part of this object. */
export function getAuthSnapshot(): AuthPublicSnapshot {
  return snapshot;
}

/** Stable SSR snapshot. The server cannot see the memory token or the API refresh cookie. */
export function getServerAuthSnapshot(): AuthPublicSnapshot {
  return SERVER_SNAPSHOT;
}

export function markAuthBootSettled(): void {
  bootSettled = true;
  publish();
}

export function getAuthEpoch(): number {
  return epoch;
}

/** Drop the in-memory token and ignore any login or refresh that started earlier. */
export function beginLogoutEpoch(): number {
  epoch += 1;
  memory.session = null;
  memory.phase = "unauthenticated";
  identityConfirmed = false;
  clearPrivateQueryCache();
  publish();
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
  publish();
}

export function setRefreshing(): void {
  memory.phase = "refreshing";
  publish();
}

export function setAuthenticated(session: AuthSessionResponse): void {
  const previousUserId = memory.session?.user.id;
  memory.session = session;
  memory.phase = "authenticated";
  identityConfirmed = false;
  if (previousUserId && previousUserId !== session.user.id) clearPrivateQueryCache();
  publish();
}

/** Record that the API accepted the current access token on GET /auth/me. */
export function confirmAuthenticatedIdentity(): void {
  if (!memory.session?.accessToken) return;
  memory.phase = "authenticated";
  identityConfirmed = true;
  publish();
}

export function applyAuthenticated(session: AuthSessionResponse, atEpoch: number): boolean {
  if (atEpoch !== epoch) return false;
  setAuthenticated(session);
  return true;
}

export function setAuthError(): void {
  memory.phase = "error";
  publish();
}

export function clearAuthSession(): void {
  memory.session = null;
  memory.phase = "unauthenticated";
  identityConfirmed = false;
  clearPrivateQueryCache();
  publish();
}

/** Test-only reset. */
export function resetAuthMemoryForTests(): void {
  memory.phase = "unauthenticated";
  memory.session = null;
  epoch = 0;
  bootSettled = false;
  identityConfirmed = false;
  snapshot = {
    phase: "unauthenticated",
    authenticated: false,
    bootSettled: false,
    identityConfirmed: false,
  };
  for (const listener of listeners) listener();
}
