import type { PublicLocale } from "@/lib/landing/locales";

/** Mirrors `SafeUserDto` without importing the shared-types barrel into client bundles. */
export type AuthUserDto = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  roleKey: string;
  agencyId: string | null;
  status: string;
};

export type AuthLocale = PublicLocale;

export type AuthClientPhase =
  | "unknown"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "refreshing"
  | "expired"
  | "error";

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthSessionResponse = {
  accessToken: string;
  user: AuthUserDto;
};

export type AuthLoginResult =
  | { ok: true; session: AuthSessionResponse }
  | { ok: false; code: AuthFailureCode; message: string };

export type AuthFailureCode =
  | "NOT_LIVE"
  | "VALIDATION"
  | "INVALID_CREDENTIALS"
  | "SESSION_EXPIRED"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "NETWORK";

export type AuthTransport = {
  login(input: LoginRequest): Promise<AuthLoginResult>;
  refresh?: () => Promise<AuthLoginResult>;
};

export type AuthAvailability = "preview" | "fixture" | "live";
