import { describe, expect, it } from "vitest";

import { MAIN_CONTENT_ID, SKIP_TO_MAIN_LABEL } from "./document-landmarks";

describe("document landmarks", () => {
  it("uses stable main content id for skip navigation", () => {
    expect(MAIN_CONTENT_ID).toBe("main");
    expect(SKIP_TO_MAIN_LABEL).toMatch(/main content/i);
  });
});
