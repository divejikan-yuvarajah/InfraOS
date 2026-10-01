import { describe, expect, it } from "vitest";

import { parseApiError } from "./errors";

describe("parseApiError", () => {
  it("uses envelope message and code when present", () => {
    const error = parseApiError(403, "Forbidden", {
      message: "Not allowed",
      code: "FORBIDDEN",
      details: { field: "role" },
    });

    expect(error.status).toBe(403);
    expect(error.message).toBe("Not allowed");
    expect(error.code).toBe("FORBIDDEN");
    expect(error.details).toEqual({ field: "role" });
  });

  it("falls back to status text for unknown bodies", () => {
    const error = parseApiError(500, "Internal Server Error", "oops");
    expect(error.message).toBe("Internal Server Error");
    expect(error.status).toBe(500);
  });
});
