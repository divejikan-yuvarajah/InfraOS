import { describe, expect, it, vi } from "vitest";

import { parseApiError } from "@/lib/api/errors";

import { getAuthAvailability } from "./availability";
import { loginWithAuthClient, logoutWithAuthClient, requestForgotPassword } from "./client";
import { forgotPasswordFormSchema } from "./forgot-password-schema";
import { loginFormSchema } from "./login-schema";
import { getAuthForgotCopy } from "./messages";
import { forgotPasswordPathForLocale, sanitizeNextParam } from "./redirect";
import { refreshAuthSessionSingleFlight, resetAuthRefreshForTests } from "./refresh-flight";
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

describe("refresh single flight", () => {
  it("shares one in-flight refresh across callers", async () => {
    resetAuthMemoryForTests();
    resetAuthRefreshForTests();
    let calls = 0;
    const transport = createFixtureAuthTransport(async () => ({
      ok: false,
      code: "NOT_LIVE",
      message: "unused",
    }));
    transport.refresh = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        ok: true,
        session: {
          accessToken: "rotated-token",
          user: {
            id: "u1",
            firstName: "A",
            lastName: "B",
            displayName: "A B",
            email: "a@example.com",
            roleKey: "AGENCY_OFFICER",
            agencyId: null,
            status: "ACTIVE",
          },
        },
      };
    };
    const [first, second] = await Promise.all([
      refreshAuthSessionSingleFlight(transport),
      refreshAuthSessionSingleFlight(transport),
    ]);
    expect(calls).toBe(1);
    expect(first.ok && second.ok).toBe(true);
    expect(getMemoryAccessToken()).toBe("rotated-token");
  });
});

const session = {
  accessToken: "memory-token",
  user: {
    id: "user-1",
    firstName: "Nila",
    lastName: "Perera",
    displayName: "Nila Perera",
    email: "nila@example.com",
    roleKey: "AGENCY_OFFICER",
    agencyId: "agency-1",
    status: "ACTIVE",
  },
};

describe("logout epoch", () => {
  it("drops the memory token and ignores a late refresh", async () => {
    resetAuthMemoryForTests();
    resetAuthRefreshForTests();
    let release: (value: void) => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started: (value: void) => void = () => {};
    const startedGate = new Promise<void>((resolve) => {
      started = resolve;
    });
    const transport = createFixtureAuthTransport(async () => ({
      ok: true,
      session,
    }));
    transport.refresh = async () => {
      started();
      await gate;
      return { ok: true, session: { ...session, accessToken: "late-token" } };
    };
    transport.logout = async () => "confirmed";
    const pending = refreshAuthSessionSingleFlight(transport);
    await startedGate;
    const outcome = await logoutWithAuthClient(transport);
    release();
    await pending;
    expect(outcome).toBe("confirmed");
    expect(getMemoryAccessToken()).toBeNull();
  });

  it("does not apply a login that finishes after logout", async () => {
    resetAuthMemoryForTests();
    let release: (value: void) => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transport = createFixtureAuthTransport(async () => {
      await gate;
      return { ok: true, session };
    });
    transport.logout = async () => "confirmed";
    const pending = loginWithAuthClient({ email: "nila@example.com", password: "secret" }, transport);
    await logoutWithAuthClient(transport);
    release();
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(getMemoryAccessToken()).toBeNull();
  });

  it("reports unconfirmed when the server cannot revoke", async () => {
    resetAuthMemoryForTests();
    const transport = createFixtureAuthTransport(async () => ({ ok: true, session }));
    transport.logout = async () => "unconfirmed";
    await loginWithAuthClient({ email: "nila@example.com", password: "secret" }, transport);
    const outcome = await logoutWithAuthClient(transport);
    expect(outcome).toBe("unconfirmed");
    expect(getMemoryAccessToken()).toBeNull();
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

describe("forgot password request", () => {
  it("keeps locale paths and rejects a bad email locally", () => {
    expect(forgotPasswordPathForLocale("en")).toBe("/forgot-password");
    expect(forgotPasswordPathForLocale("si")).toBe("/si/forgot-password");
    expect(forgotPasswordPathForLocale("ta")).toBe("/ta/forgot-password");
    expect(forgotPasswordFormSchema.safeParse({ email: "not-email" }).success).toBe(false);
    expect(getAuthForgotCopy("si").nativeReview.length).toBeGreaterThan(0);
    expect(getAuthForgotCopy("en").accepted).not.toMatch(/registered as/i);
  });

  it("treats the generic accepted envelope as accepted", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, data: { status: "ACCEPTED" }, meta: { requestId: "r" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(requestForgotPassword("officer@example.com")).resolves.toBe("accepted");
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
