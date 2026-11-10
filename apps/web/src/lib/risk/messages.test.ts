import { describe, expect, it } from "vitest";
import { RISK_COPY, getRiskCopy } from "./messages";
import {
  INDICATOR_CATALOG_EN,
  INDICATOR_CATALOG_SI,
  INDICATOR_CATALOG_TA,
  getIndicatorTitle,
  getIndicatorExplanation,
} from "./indicator-copy";

describe("Risk Dictionary Parity (en, si, ta)", () => {
  it("provides complete top-level copy for en, si, and ta", () => {
    const en = getRiskCopy("en");
    const si = getRiskCopy("si");
    const ta = getRiskCopy("ta");

    expect(en.dashboardTitle).toBeTruthy();
    expect(si.dashboardTitle).toBeTruthy();
    expect(ta.dashboardTitle).toBeTruthy();

    expect(Object.keys(en.metrics)).toEqual(Object.keys(si.metrics));
    expect(Object.keys(en.metrics)).toEqual(Object.keys(ta.metrics));

    expect(Object.keys(en.header)).toEqual(Object.keys(si.header));
    expect(Object.keys(en.header)).toEqual(Object.keys(ta.header));

    expect(Object.keys(en.charts)).toEqual(Object.keys(si.charts));
    expect(Object.keys(en.charts)).toEqual(Object.keys(ta.charts));

    expect(Object.keys(en.filters)).toEqual(Object.keys(si.filters));
    expect(Object.keys(en.filters)).toEqual(Object.keys(ta.filters));

    expect(Object.keys(en.table)).toEqual(Object.keys(si.table));
    expect(Object.keys(en.table)).toEqual(Object.keys(ta.table));

    expect(Object.keys(en.drawer)).toEqual(Object.keys(si.drawer));
    expect(Object.keys(en.drawer)).toEqual(Object.keys(ta.drawer));
  });

  it("provides indicator title and explanation fallbacks gracefully", () => {
    const dummy = { code: "DL1", titleKey: "risk.indicator.DL1.title", inputs: { overdueDays: 14, plannedEndDate: "2026-10-01", physicalProgress: 20 } };

    expect(getIndicatorTitle(dummy, "en")).toContain("Past Planned End Date");
    expect(getIndicatorTitle(dummy, "si")).toContain("සැලසුම්ගත");
    expect(getIndicatorTitle(dummy, "ta")).toContain("திட்டமிடப்பட்ட");

    expect(getIndicatorExplanation(dummy, "en")).toContain("14 calendar days");
    expect(getIndicatorExplanation(dummy, "si")).toContain("14");
    expect(getIndicatorExplanation(dummy, "ta")).toContain("14");
  });
});

