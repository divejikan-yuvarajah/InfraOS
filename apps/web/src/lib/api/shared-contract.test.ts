import { describe, expect, it } from "vitest";
import { isApiSuccess, type ApiResponse } from "@infraos/shared-types";

describe("web shared contract import", () => {
  it("narrows an API response", () => {
    const response: ApiResponse<{ ok: true }> = {
      success: true,
      data: { ok: true },
      meta: { requestId: "web-1" },
    };
    expect(isApiSuccess(response)).toBe(true);
  });
});
