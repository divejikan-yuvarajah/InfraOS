import { describe, expect, it, vi } from "vitest";

import { parseApiError } from "@/lib/api/errors";

import { getAuthAvailability } from "./availability";
import { loginWithAuthClient, logoutWithAuthClient, requestForgotPassword, resetPasswordWithAuthClient } from "./client";
import { readResetTokenFromHash, retainResetToken } from "./reset-fragment";
import { forgotPasswordFormSchema } from "./forgot-password-schema";
import { loginFormSchema } from "./login-schema";
import { getAuthForgotCopy } from "./messages";
import { forgotPasswordPathForLocale, sanitizeNextParam } from "./redirect";
import { confirmSessionWithMe } from "./confirm-identity";
import { refreshAuthSessionSingleFlight, resetAuthRefreshForTests } from "./refresh-flight";
import { clearPrivateQueryCache, registerPrivateQueryCache } from "./query-cache";
import {
  applyAuthenticated,
  beginLogoutEpoch,
  clearAuthSession,
  getAuthSnapshot,
  getMemoryAccessToken,
  getServerAuthSnapshot,
  resetAuthMemoryForTests,
  setAuthenticated,
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

describe("reset fragment retention", () => {
  it("keeps a hash token after the fragment is cleared", () => {
    const first = retainResetToken(readResetTokenFromHash("#token=fixture"), null);
    const second = retainResetToken(readResetTokenFromHash(""), first);
    expect(first).toBe("fixture");
    expect(second).toBe("fixture");
    expect(readResetTokenFromHash("")).toBeNull();
    expect(readResetTokenFromHash("#token=")).toBeNull();
  });

  it("lets a newer fragment replace the held token", () => {
    expect(retainResetToken(readResetTokenFromHash("#token=next"), "fixture")).toBe("next");
  });
});

describe("reset password client", () => {
  it("maps RESET and failure statuses without returning the token", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { token?: string; password?: string };
      expect(body.token).toBe("fixture");
      expect(body.password).toBe("long-enough");
      return new Response(JSON.stringify({ success: true, data: { status: "RESET" }, meta: { requestId: "r" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const reset = await resetPasswordWithAuthClient({ token: "fixture", password: "long-enough" });
    expect(reset).toBe("reset");
    expect(JSON.stringify(reset)).not.toContain("fixture");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: { code: "REJECTED" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(resetPasswordWithAuthClient({ token: "fixture", password: "long-enough" })).resolves.toBe("rejected");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: { code: "UNAVAILABLE" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(resetPasswordWithAuthClient({ token: "fixture", password: "long-enough" })).resolves.toBe("unavailable");
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe("session snapshot and refresh failures", () => {
  it("keeps the access token out of the reactive snapshot", () => {
    resetAuthMemoryForTests();
    expect(getServerAuthSnapshot()).toBe(getServerAuthSnapshot());
    expect(getServerAuthSnapshot().authenticated).toBe(false);
    setAuthenticated(session);
    expect(JSON.stringify(getAuthSnapshot())).not.toContain("memory-token");
    expect(getAuthSnapshot().authenticated).toBe(true);
    expect(Object.keys(getAuthSnapshot()).sort()).toEqual([
      "authenticated",
      "bootSettled",
      "identityConfirmed",
      "phase",
    ]);
  });

  it("keeps a memory session when refresh is unavailable", async () => {
    resetAuthMemoryForTests();
    resetAuthRefreshForTests();
    setAuthenticated(session);
    const transport = createFixtureAuthTransport(async () => ({
      ok: false,
      code: "NOT_LIVE",
      message: "unused",
    }));
    transport.refresh = async () => ({
      ok: false,
      code: "UNAVAILABLE",
      message: "down",
    });
    const result = await refreshAuthSessionSingleFlight(transport);
    expect(result.ok).toBe(false);
    expect(getMemoryAccessToken()).toBe("memory-token");
    expect(getAuthSnapshot().phase).toBe("error");
  });

  it("clears the memory session and private cache on expiry", async () => {
    resetAuthMemoryForTests();
    resetAuthRefreshForTests();
    setAuthenticated(session);
    let cleared = 0;
    registerPrivateQueryCache({
      clear() {
        cleared += 1;
      },
    });
    const transport = createFixtureAuthTransport(async () => ({
      ok: false,
      code: "NOT_LIVE",
      message: "unused",
    }));
    transport.refresh = async () => ({
      ok: false,
      code: "SESSION_EXPIRED",
      message: "ended",
    });
    await refreshAuthSessionSingleFlight(transport);
    expect(getMemoryAccessToken()).toBeNull();
    expect(cleared).toBe(1);
    registerPrivateQueryCache({ clear() {} });
  });

  it("does not let an in-flight refresh replace a newer sign-in", async () => {
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
    const transport = createFixtureAuthTransport(async () => ({ ok: true, session }));
    transport.refresh = async () => {
      started();
      await gate;
      return {
        ok: true,
        session: { ...session, accessToken: "stale-refresh" },
      };
    };
    const pending = refreshAuthSessionSingleFlight(transport);
    await startedGate;
    setAuthenticated(session);
    release();
    await pending;
    expect(getMemoryAccessToken()).toBe("memory-token");
  });

  it("does not treat a newer sign-in as failed when an older identity check loses", async () => {
    resetAuthMemoryForTests();
    resetAuthRefreshForTests();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubEnv("NEXT_PUBLIC_AUTH_LOGIN_ENABLED", "1");
    setAuthenticated(session);
    let releaseMe: () => void = () => {};
    const meGate = new Promise<void>((resolve) => {
      releaseMe = resolve;
    });
    let releaseRefresh: () => void = () => {};
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let meCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/me")) {
        meCalls += 1;
        if (meCalls === 1) {
          await meGate;
          return new Response(
            JSON.stringify({
              success: false,
              error: { code: "AUTH_REQUIRED", message: "sign-in is required" },
            }),
            { status: 401, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: { user: { id: "user-1" } },
            meta: { requestId: "r" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      await refreshGate;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            accessToken: "stale-refresh",
            accessTokenExpiresInSeconds: 900,
            user: session.user,
          },
          meta: { requestId: "r" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const pending = confirmSessionWithMe();
    await vi.waitFor(() => expect(meCalls).toBe(1));
    releaseMe();
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/auth/refresh"))).toBe(true),
    );
    setAuthenticated({ ...session, accessToken: "newer-token" });
    releaseRefresh();
    await pending;
    expect(getMemoryAccessToken()).toBe("newer-token");
    expect(getAuthSnapshot().phase).toBe("authenticated");
    expect(getAuthSnapshot().identityConfirmed).toBe(true);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ignores a late authenticated apply after logout", () => {
    resetAuthMemoryForTests();
    const atEpoch = beginLogoutEpoch();
    expect(applyAuthenticated(session, atEpoch - 1)).toBe(false);
    expect(getMemoryAccessToken()).toBeNull();
  });

  it("clears the registered query cache on logout", async () => {
    resetAuthMemoryForTests();
    let cleared = 0;
    const unregister = registerPrivateQueryCache({
      clear() {
        cleared += 1;
      },
    });
    const transport = createFixtureAuthTransport(async () => ({ ok: true, session }));
    transport.logout = async () => "confirmed";
    await logoutWithAuthClient(transport);
    expect(cleared).toBe(1);
    unregister();
    clearPrivateQueryCache();
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
