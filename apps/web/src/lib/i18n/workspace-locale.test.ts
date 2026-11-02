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
  const settings = all.find((i) => i.href === "/settings");
  it("uses existing translations where present", () => {
    if (!projects) throw new Error("missing");
    expect(navLabel(projects, "si")).toBe("ව්‍යාපෘති");
    expect(navLabel(projects, "ta")).toBe("திட்டங்கள்");
  });
  it("falls back to English for missing keys and never drops a link", () => {
    if (!work || !settings) throw new Error("missing");
    expect(navLabel(settings, "ta")).toBe("Settings"); // no translation yet: falls back to English
    expect(navLabel(work, "ta")).toBe("பணி கோரிக்கைகள்");
    expect(navLabel(work, "si")).toBe("වැඩ ඉල්ලීම්");
    expect(all).toHaveLength(15); // includes RoadSync Dashboard (Step 78) and Approvals / History (Steps 76-77)
  });
});
