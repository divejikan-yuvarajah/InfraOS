import { describe, expect, it } from "vitest";

import { demoCoordinationFormSchema } from "./demo-coordination-schema";
import { mapApiFailureToFormErrors } from "./errors";
import { parseLkrToMinorUnits, trimToUndefined } from "./normalizers";

const valid = {
  title: "  Segment note  ",
  agencyId: "agency-alpha",
  category: "ROAD" as const,
  startDate: "2026-02-01",
  endDate: "2026-02-10",
  amountLkr: "10.50",
  notes: "  ",
};

describe("demo coordination schema", () => {
  it("trims title and converts LKR to minor units", () => {
    const parsed = demoCoordinationFormSchema.parse(valid);
    expect(parsed.title).toBe("Segment note");
    expect(parsed.amountLkr).toBe(1050);
    expect(parsed.notes).toBeUndefined();
  });

  it("rejects whitespace-only titles", () => {
    const result = demoCoordinationFormSchema.safeParse({ ...valid, title: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects end before start", () => {
    const result = demoCoordinationFormSchema.safeParse({
      ...valid,
      startDate: "2026-03-10",
      endDate: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("does not coerce a blank amount to zero", () => {
    const parsed = demoCoordinationFormSchema.parse({ ...valid, amountLkr: "" });
    expect(parsed.amountLkr).toBeUndefined();
  });
});

describe("normalizers", () => {
  it("rejects excessive decimal precision", () => {
    expect(() => parseLkrToMinorUnits("1.234")).toThrow();
  });

  it("trims blanks to undefined", () => {
    expect(trimToUndefined("   ")).toBeUndefined();
  });
});

describe("API error mapping", () => {
  it("maps allowed field paths and drops prototype keys", () => {
    const mapped = mapApiFailureToFormErrors(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          details: {
            fieldErrors: {
              title: "Too short",
              ["__proto__"]: "nope",
              unknownField: "ignore",
            },
          },
        },
        meta: { requestId: "req-1" },
      },
      ["title", "endDate"],
    );
    expect(mapped.fieldErrors).toEqual([{ path: "title", message: "Too short" }]);
    expect(mapped.formMessage).toMatch(/ignore/i);
    expect(mapped.requestId).toBe("req-1");
  });

  it("keeps unknown-only validation messages on the summary", () => {
    const mapped = mapApiFailureToFormErrors(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          details: { fieldErrors: { unknownField: "Cannot use that value." } },
        },
        meta: { requestId: "req-3" },
      },
      ["title"],
    );
    expect(mapped.fieldErrors).toEqual([]);
    expect(mapped.formMessage).toBe("Cannot use that value.");
  });

  it("uses conflict and rate-limit copy without the raw server message", () => {
    const conflict = mapApiFailureToFormErrors(
      {
        success: false,
        error: { code: "CONFLICT_DETECTED", message: "internal race", details: null },
        meta: { requestId: "req-4" },
      },
      ["title"],
    );
    expect(conflict.formMessage).toMatch(/conflict/i);
    expect(conflict.formMessage).not.toMatch(/race/);

    const limited = mapApiFailureToFormErrors(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "retry token", details: null },
        meta: { requestId: "req-5" },
      },
      ["title"],
    );
    expect(limited.formMessage).toMatch(/wait/i);
  });

  it("uses a non-sensitive message for forbidden errors", () => {
    const mapped = mapApiFailureToFormErrors(
      {
        success: false,
        error: { code: "FORBIDDEN", message: "stack trace", details: null },
        meta: { requestId: "req-2" },
      },
      ["title"],
    );
    expect(mapped.formMessage).toMatch(/permission/i);
    expect(mapped.formMessage).not.toMatch(/stack/);
  });
});
