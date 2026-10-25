import { describe, expect, it } from "vitest";

import { classifyAppPath } from "@/lib/auth/route-access";

import { getProjectCopy, projectListMessage } from "./messages";

describe("project list presentation", () => {
  it("keeps the staff route private and maps errors", () => {
    expect(classifyAppPath("/projects")).toBe("private");
    expect(classifyAppPath("/si/projects")).toBe("public");
    expect(classifyAppPath("/ta/projects")).toBe("public");
    const copy = getProjectCopy("en");
    expect(projectListMessage(403, copy)).toBe(copy.forbidden);
    expect(projectListMessage(503, copy)).toBe(copy.unavailable);
    expect(getProjectCopy("si").title).not.toBe(copy.title);
    expect(getProjectCopy("ta").empty).not.toBe(copy.empty);
  });
});
