import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("px-2", false && "hidden", "text-sm")).toContain("px-2");
    expect(cn("px-2", "text-sm")).toContain("text-sm");
  });
});
