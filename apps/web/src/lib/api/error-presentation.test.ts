import { describe, expect, it } from "vitest";

import { ApiError } from "./errors";
import { presentApiError, presentApiFailure, presentUnknownError } from "./error-presentation";

describe("error presentation", () => {
  it("maps forbidden failures without raw server text", () => {
    const view = presentApiFailure({
      success: false,
      error: { code: "FORBIDDEN", message: "mongo stack trace", details: null },
      meta: { requestId: "req-safe-1" },
    });
    expect(view.kind).toBe("forbidden");
    expect(view.title).toMatch(/access/i);
    expect(JSON.stringify(view)).not.toMatch(/mongo/);
    expect(view.requestId).toBe("req-safe-1");
  });

  it("maps 404 and 429 transport errors", () => {
    expect(presentApiError(new ApiError("hidden", 404)).kind).toBe("not-found");
    expect(presentApiError(new ApiError("hidden", 429)).kind).toBe("rate-limit");
  });

  it("delegates validation errors to Step 20 forms", () => {
    const view = presentApiFailure({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "bad title", details: { fieldErrors: {} } },
      meta: { requestId: "req-v" },
    });
    expect(view.kind).toBe("validation-delegate");
    expect(view.showRetry).toBe(false);
  });

  it("maps network TypeError safely", () => {
    const view = presentUnknownError(new TypeError("Failed to fetch"));
    expect(view.kind).toBe("network");
    expect(view.showRetry).toBe(true);
    expect(view.description).not.toMatch(/Failed to fetch/);
  });

  it("maps 5xx to retryable server state", () => {
    const view = presentApiError(new ApiError("internal", 500, { code: "INTERNAL_ERROR" }));
    expect(view.kind).toBe("server");
    expect(view.showRetry).toBe(true);
  });
});
