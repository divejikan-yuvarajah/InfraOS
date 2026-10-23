import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { getAuthAvailability } from "./availability";
import type { AuthLoginResult, AuthSessionResponse, AuthTransport, LoginRequest } from "./types";

const LOGIN_PATH = "/api/v1/auth/login";

function mapApiFailure(status: number, code: string | undefined): AuthLoginResult {
  if (status === 401) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Sign-in could not be completed. Check your email and password.",
    };
  }
  if (status === 429 || code === "RATE_LIMITED") {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many attempts. Wait a moment and try again.",
    };
  }
  if (status >= 500 || code === "SERVICE_UNAVAILABLE" || code === "NOT_READY") {
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "Sign-in is temporarily unavailable. Try again later.",
    };
  }
  return {
    ok: false,
    code: "INVALID_CREDENTIALS",
    message: "Sign-in could not be completed. Check your email and password.",
  };
}

function parseLoginEnvelope(body: unknown): AuthSessionResponse | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.success !== true || !record.data || typeof record.data !== "object") {
    return null;
  }
  const data = record.data as Record<string, unknown>;
  if (typeof data.accessToken !== "string" || !data.user || typeof data.user !== "object") {
    return null;
  }
  const user = data.user as Record<string, unknown>;
  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.displayName !== "string" ||
    typeof user.roleKey !== "string" ||
    typeof user.status !== "string"
  ) {
    return null;
  }
  return {
    accessToken: data.accessToken,
    user: {
      id: user.id,
      firstName: typeof user.firstName === "string" ? user.firstName : "",
      lastName: typeof user.lastName === "string" ? user.lastName : "",
      displayName: user.displayName,
      email: user.email,
      roleKey: user.roleKey as AuthSessionResponse["user"]["roleKey"],
      agencyId: typeof user.agencyId === "string" ? user.agencyId : null,
      status: user.status as AuthSessionResponse["user"]["status"],
    },
  };
}

export function createLiveAuthTransport(): AuthTransport {
  return {
    async login(input: LoginRequest): Promise<AuthLoginResult> {
      try {
        const response = await apiClient<unknown>(LOGIN_PATH, {
          method: "POST",
          body: input,
          credentials: "include",
        });
        const session = parseLoginEnvelope(response);
        if (!session) {
          return {
            ok: false,
            code: "UNAVAILABLE",
            message: "Sign-in is temporarily unavailable. Try again later.",
          };
        }
        return { ok: true, session };
      } catch (error) {
        if (error instanceof ApiError) {
          return mapApiFailure(error.status, error.code);
        }
        return {
          ok: false,
          code: "NETWORK",
          message: "Network error. Check your connection and try again.",
        };
      }
    },
  };
}

export function createPreviewAuthTransport(): AuthTransport {
  return {
    async login(): Promise<AuthLoginResult> {
      return {
        ok: false,
        code: "NOT_LIVE",
        message:
          "Sign-in is not live yet. Step 39 will connect this form to the authentication service.",
      };
    },
  };
}

export function createFixtureAuthTransport(
  handler: (input: LoginRequest) => Promise<AuthLoginResult>,
): AuthTransport {
  return { login: handler };
}

export function resolveAuthTransport(override?: AuthTransport): AuthTransport {
  if (override) return override;
  const mode = getAuthAvailability();
  if (mode === "live") return createLiveAuthTransport();
  return createPreviewAuthTransport();
}
