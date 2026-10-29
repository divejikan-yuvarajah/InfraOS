import { describe, expect, it } from "vitest";

import { progressFormSchema, progressNoteReady } from "./progress-form";

describe("physical progress form", () => {
  it("accepts 0 to 100 with a note and requires a longer note to go backwards", () => {
    expect(progressFormSchema.safeParse({ percentage: 0, note: "None yet" }).success).toBe(true);
    expect(progressFormSchema.safeParse({ percentage: 100, note: "Reported" }).success).toBe(true);
    expect(progressFormSchema.safeParse({ percentage: 101, note: "Too high" }).success).toBe(false);
    expect(progressFormSchema.safeParse({ percentage: 20, note: "Deck", financialProgress: 1 }).success).toBe(false);
    expect(progressNoteReady(20, 65, "Abutment")).toBe(true);
    expect(progressNoteReady(100, 80, "short")).toBe(false);
    expect(progressNoteReady(100, 80, "Corrected after a recount")).toBe(true);
  });
});
