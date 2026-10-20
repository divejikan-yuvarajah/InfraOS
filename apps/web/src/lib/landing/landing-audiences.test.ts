import { describe, expect, it } from "vitest";

import { AUDIENCE_GROUP_IDS } from "./audience-groups";
import { PUBLIC_LOCALES } from "./locales";
import { getPublicCopy } from "./messages";
import { AUDIENCES_SECTION_ANCHOR } from "./navigation";

describe("public landing audiences (Step 29)", () => {
  it("uses the audiences section anchor", () => {
    expect(AUDIENCES_SECTION_ANCHOR).toBe("audiences");
  });

  it("defines four audience groups in every locale", () => {
    for (const locale of PUBLIC_LOCALES) {
      const groups = getPublicCopy(locale).audiences.groups;
      expect(groups.map((g) => g.id)).toEqual([...AUDIENCE_GROUP_IDS]);
    }
  });

  it("uses only in-page anchor targets for audience actions", () => {
    for (const locale of PUBLIC_LOCALES) {
      for (const group of getPublicCopy(locale).audiences.groups) {
        expect(group.actionAnchor).toMatch(/^(problem|solution|features|lifecycle)$/);
      }
    }
  });

  it("avoids fake metrics and login routes in audience copy", () => {
    for (const locale of PUBLIC_LOCALES) {
      const text = [
        getPublicCopy(locale).audiences.intro,
        getPublicCopy(locale).audiences.benefitsDisclaimer,
        getPublicCopy(locale).audiences.staffAccessNote,
        ...getPublicCopy(locale).audiences.benefits.map((b) => b.text),
        ...getPublicCopy(locale).audiences.groups.map((g) => g.body),
      ]
        .join(" ")
        .toLowerCase();
      expect(text).not.toMatch(/\/login|%\s|rs\.?\s*\d|billion|million projects/);
      expect(text).not.toMatch(/official national portal|government approved/i);
    }
  });

  it("labels benefits as intended goals not proven outcomes", () => {
    for (const locale of PUBLIC_LOCALES) {
      const block = `${getPublicCopy(locale).audiences.benefitsTitle} ${getPublicCopy(locale).audiences.benefitsDisclaimer}`;
      expect(block).toMatch(
        /intended|not proven|design goals|අපේක්ෂ|සැලසුම්|මූලාකෘත|எதிர்பார்க்க|வடிவமைப்பு|மாதிரி/,
      );
    }
  });
});
