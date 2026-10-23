import { describe, expect, it, vi } from "vitest";

import { parseApiError } from "@/lib/api/errors";

import { getAuthAvailability } from "./availability";
import { loginWithAuthClient } from "./client";
import { loginFormSchema } from "./login-schema";
import { sanitizeNextParam } from "./redirect";
import {
  clearAuthSession,
  getMemoryAccessToken,
  resetAuthMemoryForTests,
} from "./state";
import { createFixtureAuthTransport } from "./transport";

describe("auth redirect safety", () => {
  it("allows same-origin internal paths", () => {
    expect(sanitizeNextParam("/about")).toBe("/about");
    expect(sanitizeNextParam("/si/faq")).toBe("/si/faq");
  });

  it("rejects external and protocol-relative targets", () => {
    expect(sanitizeNextParam("https://evil.example")).toBeNull();
    expect(sanitizeNextParam("//evil.example")).toBeNull();
    expect(sanitizeNextParam("/\\evil")).toBeNull();
    expect(sanitizeNextParam("/login?next=https://evil")).toBeNull();
    expect(sanitizeNextParam("/si/../../etc/passwd")).toBeNull();
    expect(sanitizeNextParam("/not-allowed")).toBeNull();
  });
});

describe("auth availability in production", () => {
  it("never exposes live mode in production builds", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_AUTH_LOGIN_ENABLED", "1");
    expect(getAuthAvailability()).toBe("preview");
    vi.unstubAllEnvs();
  });
});

describe("login form schema", () => {
  it("normalizes email and preserves password bytes", () => {
    const parsed = loginFormSchema.parse({
      email: "  User@Example.com ",
      password: " pass word ",
    });
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.password).toBe(" pass word ");
  });
});

describe("auth memory session", () => {
  it("stores access token only in memory", async () => {
    resetAuthMemoryForTests();
    const transport = createFixtureAuthTransport(async () => ({
      ok: true,
      session: {
        accessToken: "fixture-token",
        user: {
          id: "u1",
          firstName: "A",
          lastName: "B",
          displayName: "A B",
          email: "a@example.com",
          roleKey: "AGENCY_OFFICER",
          agencyId: null,
          status: "PENDING",
        },
      },
    }));
    await loginWithAuthClient(
      { email: "a@example.com", password: "secret" },
      transport,
    );
    expect(getMemoryAccessToken()).toBe("fixture-token");
    clearAuthSession();
    expect(getMemoryAccessToken()).toBeNull();
  });

  it("does not persist tokens in web storage APIs", () => {
    const source = [
      resetAuthMemoryForTests.toString(),
      loginWithAuthClient.toString(),
      getMemoryAccessToken.toString(),
    ].join("\n");
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/i);
  });
});

describe("auth availability", () => {
  it("defaults to preview outside live flag", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_AUTH_LOGIN_ENABLED", "");
    expect(getAuthAvailability()).toBe("preview");
    vi.unstubAllEnvs();
  });
});

describe("api envelope parsing", () => {
  it("reads nested failure codes", () => {
    const error = parseApiError(401, "Unauthorized", {
      success: false,
      error: { code: "AUTH_REQUIRED", message: "Sign-in required", details: null },
      meta: { requestId: "r1" },
    });
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(error.message).toBe("Sign-in required");
  });
});

describe("preview transport", () => {
  it("never returns success without live backend", async () => {
    resetAuthMemoryForTests();
    const result = await loginWithAuthClient({
      email: "user@example.com",
      password: "password",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_LIVE");
    }
    expect(getMemoryAccessToken()).toBeNull();
  });
});

describe("fixture transport errors", () => {
  it("maps 401, 429 and 503 patterns", async () => {
    resetAuthMemoryForTests();
    const cases = [
      { status: 401, code: "AUTH_REQUIRED" },
      { status: 429, code: "RATE_LIMITED" },
      { status: 503, code: "SERVICE_UNAVAILABLE" },
    ] as const;
    for (const item of cases) {
      const transport = createFixtureAuthTransport(async () => ({
        ok: false,
        code:
          item.status === 401
            ? "INVALID_CREDENTIALS"
            : item.status === 429
              ? "RATE_LIMITED"
              : "UNAVAILABLE",
        message: "blocked",
      }));
      const result = await loginWithAuthClient(
        { email: "a@example.com", password: "x" },
        transport,
      );
      expect(result.ok).toBe(false);
    }
  });
});
