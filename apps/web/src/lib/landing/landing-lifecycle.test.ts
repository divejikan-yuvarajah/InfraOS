import { describe, expect, it } from "vitest";

import { LIFECYCLE_STAGE_IDS } from "./lifecycle-stages";
import { getPublicCopy } from "./messages";
import { HOW_IT_WORKS_SECTION_ANCHOR } from "./navigation";
import { PUBLIC_LOCALES } from "./locales";

describe("public landing lifecycle (Step 28)", () => {
  it("uses the how-it-works anchor id", () => {
    expect(HOW_IT_WORKS_SECTION_ANCHOR).toBe("how-it-works");
  });

  it("defines exactly eight canonical stages in order for every locale", () => {
    for (const locale of PUBLIC_LOCALES) {
      const stages = getPublicCopy(locale).lifecycle.stages;
      expect(stages.map((s) => s.id)).toEqual([...LIFECYCLE_STAGE_IDS]);
    }
  });

  it("avoids AI approval and automatic cancellation claims", () => {
    for (const locale of PUBLIC_LOCALES) {
      const text = [
        getPublicCopy(locale).lifecycle.intro,
        getPublicCopy(locale).lifecycle.scenarioBody,
        getPublicCopy(locale).lifecycle.approvalsNote,
        ...getPublicCopy(locale).lifecycle.stages.map((s) => s.body),
      ]
        .join(" ")
        .toLowerCase();
      expect(text).toMatch(/human|authorized|official|අධිකාර|மனித|அதிகார/);
      expect(text).not.toMatch(/ai approves|automatically approves|autonomous approval/);
    }
  });

  it("labels the illustrative scenario as synthetic", () => {
    for (const locale of PUBLIC_LOCALES) {
      const block = `${getPublicCopy(locale).lifecycle.scenarioTitle} ${getPublicCopy(locale).lifecycle.scenarioBody}`.toLowerCase();
      expect(block).toMatch(/illustrative|synthetic|ආදර්ශ|කෘත්‍ර|எடுத்துக்காட்டு|செயற்கை/);
    }
  });
});
