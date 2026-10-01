import { describe, expect, it } from "vitest";

import { AppError } from "../src/shared/errors/app-error.js";
import { failure, success } from "../src/shared/http/envelope.js";

describe("API envelope", () => {
  it("builds a success payload with requestId", () => {
    const body = success({ status: "ok" }, "req-1");
    expect(body).toEqual({
      success: true,
      data: { status: "ok" },
      meta: { requestId: "req-1" },
    });
  });

  it("builds a failure payload with null details by default", () => {
    const body = failure("ROUTE_NOT_FOUND", "Missing", "req-2");
    expect(body.error.details).toBeNull();
    expect(body.meta.requestId).toBe("req-2");
  });
});

describe("AppError", () => {
  it("stores operational fields", () => {
    const error = new AppError(404, "ROUTE_NOT_FOUND", "Missing");
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });
});
