import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";

import { getAiAdminCopy } from "./messages";
import {
  canExportAuditCsv,
  canManageAi,
  canUseCopilot,
  formatCountdownSeconds,
  formatCurrencyMinor,
  hasAnyAiAccess,
  mapAiFailure,
} from "./view";

describe("ai-admin view & role gating helpers", () => {
  const copy = getAiAdminCopy("en");

  it("enforces exact role gating matching backend permissions", () => {
    expect(hasAnyAiAccess("INSPECTOR")).toBe(true);
    expect(canUseCopilot("INSPECTOR")).toBe(true);
    expect(canManageAi("INSPECTOR")).toBe(false);
    expect(canManageAi("PROJECT_MANAGER")).toBe(false);
    expect(canManageAi("GOV_ADMIN")).toBe(true);
    expect(canExportAuditCsv("SUPER_ADMIN")).toBe(true);
    expect(hasAnyAiAccess("CONTRACTOR")).toBe(false);
    expect(hasAnyAiAccess("CITIZEN")).toBe(false);
  });

  it("formats countdown windows clearly", () => {
    expect(formatCountdownSeconds(42, copy)).toBe("42s");
    expect(formatCountdownSeconds(125, copy)).toBe("2m 5s");
  });

  it("maps error codes per failure matrix without exposing internals", () => {
    const rateErr = new ApiError("too many requests", 429, {
      code: "AI_RATE_LIMITED",
      details: { retryAfterSeconds: 95 },
    });
    const mapped = mapAiFailure(rateErr, copy, "en");
    expect(mapped.code).toBe("AI_RATE_LIMITED");
    expect(mapped.retryAfterSeconds).toBe(95);
    expect(mapped.message).toContain("1m 35s");

    const disabledErr = new ApiError("disabled", 403, { code: "FEATURE_DISABLED" });
    expect(mapAiFailure(disabledErr, copy, "en").code).toBe("FEATURE_DISABLED");
  });

  it("formats verified AI costs in USD minor units rather than LKR", () => {
    const formatted = formatCurrencyMinor(1250, "en");
    expect(formatted).toContain("12.50");
    expect(formatted).not.toContain("LKR");
    expect(formatCurrencyMinor(null, "en")).toBe("—");
  });
});

