import { describe, expect, it } from "vitest";
import { z, ZodError } from "zod";

import { validate } from "../src/middleware/validate.js";

describe("validate middleware", () => {
  it("rejects invalid bodies", () => {
    const middleware = validate({ body: z.object({ name: z.string().min(1) }) });
    let captured: unknown;

    middleware({ body: {} } as never, {} as never, (error?: unknown) => {
      captured = error;
    });

    expect(captured).toBeInstanceOf(ZodError);
  });

  it("replaces body with parsed data", () => {
    const middleware = validate({ body: z.object({ name: z.string() }) });
    const req = { body: { name: "INFRAOS" } };
    let called = false;

    middleware(req as never, {} as never, (error?: unknown) => {
      expect(error).toBeUndefined();
      called = true;
    });

    expect(called).toBe(true);
    expect(req.body).toEqual({ name: "INFRAOS" });
  });
});
