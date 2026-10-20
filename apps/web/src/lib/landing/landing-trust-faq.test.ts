import { describe, expect, it } from "vitest";

import {
  FAQ_ITEM_IDS,
  FAQ_SECTION_ANCHOR,
  NEXT_STEPS_SECTION_ANCHOR,
  TRUST_SECTION_ANCHOR,
} from "./faq-items";
import { PUBLIC_LOCALES } from "./locales";
import { getPublicCopy } from "./messages";
import {
  FEATURES_SECTION_ANCHOR,
  HOW_IT_WORKS_SECTION_ANCHOR,
} from "./navigation";
import { PREVIEW_SECTION_ANCHOR } from "./preview-data";

const VALID_NEXT_ANCHORS = {
  features: FEATURES_SECTION_ANCHOR,
  lifecycle: HOW_IT_WORKS_SECTION_ANCHOR,
  preview: PREVIEW_SECTION_ANCHOR,
} as const;

describe("public landing trust, FAQ and next steps (Step 31)", () => {
  it("uses stable section anchors", () => {
    expect(TRUST_SECTION_ANCHOR).toBe("trust-information");
    expect(FAQ_SECTION_ANCHOR).toBe("faq");
    expect(NEXT_STEPS_SECTION_ANCHOR).toBe("next-steps");
  });

  it("defines nine FAQ items in every locale", () => {
    for (const locale of PUBLIC_LOCALES) {
      const items = getPublicCopy(locale).faq.items;
      expect(items.map((i) => i.id)).toEqual([...FAQ_ITEM_IDS]);
    }
  });

  it("avoids official endorsement and fake login claims", () => {
    for (const locale of PUBLIC_LOCALES) {
      const blob = JSON.stringify({
        trust: getPublicCopy(locale).trust,
        faq: getPublicCopy(locale).faq,
        next: getPublicCopy(locale).nextSteps,
      }).toLowerCase();
      expect(blob).not.toMatch(/\/login|government approved|certified secure|official national portal/);
      expect(blob).toMatch(/university|demonstration|prototype|විශ්ව|பல்கலை|draft|pending/);
    }
  });

  it("points next-step CTAs at existing section anchors only", () => {
    for (const locale of PUBLIC_LOCALES) {
      const next = getPublicCopy(locale).nextSteps;
      expect(VALID_NEXT_ANCHORS[next.primaryAnchor]).toBeTruthy();
      expect(VALID_NEXT_ANCHORS[next.secondaryAnchor]).toBeTruthy();
    }
  });

  it("includes a visible demo disclaimer in trust copy", () => {
    for (const locale of PUBLIC_LOCALES) {
      const notice = getPublicCopy(locale).trust.demoNotice;
      expect(notice.length).toBeGreaterThan(20);
    }
  });
});
