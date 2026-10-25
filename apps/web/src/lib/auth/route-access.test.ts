import { describe, expect, it } from "vitest";

import { loginHrefForPrivatePath, sanitizeNextParam } from "./redirect";
import {
  classifyAppPath,
  privateAccessDecision,
  type AuthPublicSnapshot,
} from "./route-access";

const settled: AuthPublicSnapshot = {
  phase: "unauthenticated",
  authenticated: false,
  bootSettled: true,
  identityConfirmed: false,
};

describe("route classification", () => {
  it("keeps marketing, locale, recovery, and unknown paths public or auth", () => {
    expect(classifyAppPath("/")).toBe("public");
    expect(classifyAppPath("/si")).toBe("public");
    expect(classifyAppPath("/ta/about")).toBe("public");
    expect(classifyAppPath("/public-map")).toBe("public");
    expect(classifyAppPath("/mapping")).toBe("public");
    expect(classifyAppPath("/404")).toBe("public");
    expect(classifyAppPath("/not-a-module")).toBe("public");
    expect(classifyAppPath("/dev/design-system")).toBe("public");
    expect(classifyAppPath("/login")).toBe("auth");
    expect(classifyAppPath("/si/forgot-password")).toBe("auth");
    expect(classifyAppPath("/ta/reset-password")).toBe("auth");
    expect(classifyAppPath("/verify-email")).toBe("auth");
  });

  it("matches staff prefixes by segment, including nested paths", () => {
    expect(classifyAppPath("/profile")).toBe("private");
    expect(classifyAppPath("/settings")).toBe("private");
    expect(classifyAppPath("/dashboard")).toBe("private");
    expect(classifyAppPath("/projects/42/edit")).toBe("private");
    expect(classifyAppPath("/map")).toBe("private");
    expect(classifyAppPath("/admin/users")).toBe("private");
    expect(classifyAppPath("/roadsync")).toBe("private");
    expect(classifyAppPath("/si/dashboard")).toBe("public");
    expect(classifyAppPath("/dashboarding")).toBe("public");
  });
});

describe("private access decision", () => {
  it("waits while boot or refresh is unfinished", () => {
    expect(
      privateAccessDecision({
        availability: "live",
        snapshot: { phase: "unknown", authenticated: false, bootSettled: false, identityConfirmed: false },
      }),
    ).toBe("loading");
    expect(
      privateAccessDecision({
        availability: "live",
        snapshot: { phase: "refreshing", authenticated: false, bootSettled: false, identityConfirmed: false },
      }),
    ).toBe("loading");
  });

  it("separates preview, retry, login, and content", () => {
    expect(privateAccessDecision({ availability: "preview", snapshot: settled })).toBe("preview");
    expect(
      privateAccessDecision({
        availability: "live",
        snapshot: { phase: "error", authenticated: false, bootSettled: true, identityConfirmed: false },
      }),
    ).toBe("retry");
    expect(privateAccessDecision({ availability: "live", snapshot: settled })).toBe("login");
    expect(
      privateAccessDecision({
        availability: "live",
        snapshot: { phase: "authenticated", authenticated: true, bootSettled: true, identityConfirmed: false },
      }),
    ).toBe("confirm");
    expect(
      privateAccessDecision({
        availability: "live",
        snapshot: { phase: "authenticated", authenticated: true, bootSettled: true, identityConfirmed: true },
      }),
    ).toBe("content");
    expect(
      privateAccessDecision({
        availability: "preview",
        snapshot: { phase: "authenticated", authenticated: true, bootSettled: true, identityConfirmed: false },
      }),
    ).toBe("preview");
  });
});

describe("next allowlist", () => {
  it("allows the dashboard and public pages, and strips reset fragments", () => {
    expect(sanitizeNextParam("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextParam("/dashboard?section=access")).toBe("/dashboard?section=access");
    expect(sanitizeNextParam("/dashboard#token=fixture")).toBe("/dashboard");
    expect(sanitizeNextParam("/dashboard?token=fixture")).toBe("/dashboard");
    expect(sanitizeNextParam("/si/faq")).toBe("/si/faq");
    expect(sanitizeNextParam("/about")).toBe("/about");
  });

  it("rejects open redirects, auth loops, traversal, and missing pages", () => {
    expect(sanitizeNextParam("https://evil.example")).toBeNull();
    expect(sanitizeNextParam("//evil.example")).toBeNull();
    expect(sanitizeNextParam("/\\evil")).toBeNull();
    expect(sanitizeNextParam("/login")).toBeNull();
    expect(sanitizeNextParam("/si/login")).toBeNull();
    expect(sanitizeNextParam("/login?next=https://evil")).toBeNull();
    expect(sanitizeNextParam("/si/../../etc/passwd")).toBeNull();
    expect(sanitizeNextParam("/%2e%2e/secret")).toBeNull();
    expect(sanitizeNextParam("/%2F%2Fevil.example")).toBeNull();
    expect(sanitizeNextParam("/dash\nboard")).toBeNull();
    expect(sanitizeNextParam("/%00dashboard")).toBeNull();
    expect(sanitizeNextParam("/%252e%252e/secret")).toBeNull();
    expect(sanitizeNextParam("/dashboard%5c..%5csecret")).toBeNull();
    expect(sanitizeNextParam("/reset-password#token=fixture")).toBeNull();
    expect(sanitizeNextParam("/not-allowed")).toBeNull();
    expect(sanitizeNextParam("/si/dashboard")).toBeNull();
    expect(loginHrefForPrivatePath("/dashboard", "?section=access")).toBe(
      "/login?next=%2Fdashboard%3Fsection%3Daccess",
    );
  });
});
