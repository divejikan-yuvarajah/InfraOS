import { describe, expect, it } from "vitest";

import { navLabel, WORKSPACE_NAV } from "@/components/auth/workspace-nav";

import { parseWorkspaceLocale } from "./workspace-locale";

describe("workspace locale", () => {
  it("accepts only en/si/ta and falls back to English", () => {
    expect(parseWorkspaceLocale("si")).toBe("si");
    expect(parseWorkspaceLocale("ta")).toBe("ta");
    expect(parseWorkspaceLocale("fr")).toBe("en");
    expect(parseWorkspaceLocale(null)).toBe("en");
    expect(parseWorkspaceLocale("<script>")).toBe("en");
  });
});

describe("nav labels", () => {
  const all = WORKSPACE_NAV.flatMap((g) => g.items);
  const projects = all.find((i) => i.href === "/projects");
  const work = all.find((i) => i.href === "/roadsync/work-requests");
  it("uses existing translations where present", () => {
    if (!projects) throw new Error("missing");
    expect(navLabel(projects, "si")).toBe("ව්‍යාපෘති");
    expect(navLabel(projects, "ta")).toBe("திட்டங்கள்");
  });
  it("falls back to English for missing keys and never drops a link", () => {
    if (!work) throw new Error("missing");
    expect(navLabel(work, "ta")).toBe("Work Requests");
    expect(all).toHaveLength(10);
  });
});
