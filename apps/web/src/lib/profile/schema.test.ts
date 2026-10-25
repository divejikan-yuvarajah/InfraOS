import { describe, expect, it } from "vitest";

import { profileFormSchema } from "./schema";

describe("profile form schema", () => {
  it("accepts unicode names and trims whitespace", () => {
    const parsed = profileFormSchema.parse({ firstName: "  නිමල් ", lastName: "පෙරේරා" });
    expect(parsed.firstName).toBe("නිමල්");
    expect(parsed.lastName).toBe("පෙරේරා");
  });

  it("rejects control characters and empty names", () => {
    expect(profileFormSchema.safeParse({ firstName: "\u0007", lastName: "Perera" }).success).toBe(false);
    expect(profileFormSchema.safeParse({ firstName: "  ", lastName: "Perera" }).success).toBe(false);
  });
});
