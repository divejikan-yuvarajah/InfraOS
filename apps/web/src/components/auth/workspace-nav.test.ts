import { describe, expect, it } from "vitest";

import { initialsOf, navCurrent } from "./workspace-nav";

describe("workspace nav", () => {
  it("highlights Projects for nested project routes but not review routes", () => {
    expect(navCurrent("/projects/123/timeline", "/projects")).toBe(true);
    expect(navCurrent("/projects/123/review", "/projects")).toBe(false);
    expect(navCurrent("/projects/123/review", "/projects/reviews")).toBe(true);
    expect(navCurrent("/projects/reviews", "/projects/reviews")).toBe(true);
    expect(navCurrent("/projects/reviews", "/projects")).toBe(false);
  });
  it("matches admin and singular routes exactly or by prefix", () => {
    expect(navCurrent("/admin/users", "/admin/users")).toBe(true);
    expect(navCurrent("/admin/users", "/admin/roles")).toBe(false);
    expect(navCurrent("/dashboard", "/dashboard")).toBe(true);
  });
  it("derives initials safely", () => {
    expect(initialsOf("Nimal Perera")).toBe("NP");
    expect(initialsOf("தமிழ்")).not.toBe("?");
    expect(initialsOf("")).toBe("?");
  });
});
