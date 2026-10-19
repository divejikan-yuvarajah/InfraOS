import { describe, expect, it } from "vitest";

import { INFRAOS_ACCESSIBLE_TEXT, INFRAOS_BRAND, INFRAOS_NEUTRALS } from "./brand-tokens";
import {
  contrastRatio,
  meetsWcagAaNormalText,
  meetsWcagAaLargeText,
} from "./contrast";

describe("INFRAOS color contrast (Step 17)", () => {
  it("primary button uses dark text on brand orange", () => {
    expect(
      meetsWcagAaNormalText(
        INFRAOS_ACCESSIBLE_TEXT.onBrand.primaryButton,
        INFRAOS_BRAND.orange,
      ),
    ).toBe(true);
    expect(
      contrastRatio(
        INFRAOS_ACCESSIBLE_TEXT.onBrand.primaryButton,
        INFRAOS_BRAND.orange,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("accessible orange text on white canvas", () => {
    expect(
      meetsWcagAaNormalText(
        INFRAOS_ACCESSIBLE_TEXT.onLight.orange,
        INFRAOS_NEUTRALS.surface,
      ),
    ).toBe(true);
  });

  it("status pending text on pending surface", () => {
    expect(
      meetsWcagAaNormalText(
        INFRAOS_ACCESSIBLE_TEXT.onLight.yellow,
        "#FFF8E6",
      ),
    ).toBe(true);
  });

  it("status success text on success surface", () => {
    expect(
      meetsWcagAaNormalText(
        INFRAOS_ACCESSIBLE_TEXT.onLight.green,
        "#ECFDF3",
      ),
    ).toBe(true);
  });

  it("critical text on critical surface", () => {
    expect(
      meetsWcagAaNormalText(
        INFRAOS_ACCESSIBLE_TEXT.onLight.critical,
        "#FDECEE",
      ),
    ).toBe(true);
  });

  it("white text on maroon destructive (large UI acceptable)", () => {
    expect(
      meetsWcagAaLargeText(
        INFRAOS_ACCESSIBLE_TEXT.onBrand.onMaroon,
        INFRAOS_BRAND.maroon,
      ),
    ).toBe(true);
    expect(
      meetsWcagAaNormalText(
        INFRAOS_ACCESSIBLE_TEXT.onBrand.onMaroon,
        INFRAOS_BRAND.maroon,
      ),
    ).toBe(true);
  });

  it("documents insufficient pairs (brand swatch as body text on white)", () => {
    expect(
      meetsWcagAaNormalText(INFRAOS_BRAND.orange, INFRAOS_NEUTRALS.surface),
    ).toBe(false);
    expect(
      meetsWcagAaNormalText(INFRAOS_BRAND.yellow, INFRAOS_NEUTRALS.surface),
    ).toBe(false);
  });
});
