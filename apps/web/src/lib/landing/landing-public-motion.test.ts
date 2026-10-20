import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MOTION_MS } from "@/lib/design/design-tokens";

import { PUBLIC_LANDING_MOTION_POLICY } from "./public-motion";

describe("Step 33 public landing motion", () => {
  it("documents a CSS-first policy without GSAP", () => {
    expect(PUBLIC_LANDING_MOTION_POLICY.approach).toBe("css-tokens-only");
    expect(PUBLIC_LANDING_MOTION_POLICY.gsapInstalled).toBe(false);
    expect(PUBLIC_LANDING_MOTION_POLICY.contentVisibility).toBe("ssr-visible-without-js");
  });

  it("aligns motion CSS with Step 18 token durations", () => {
    const cssPath = resolve(
      process.cwd(),
      "src/styles/public-landing-motion.css",
    );
    const css = readFileSync(cssPath, "utf8");
    expect(css).toContain("--motion-duration-normal");
    expect(css).toContain("prefers-reduced-motion: no-preference");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toMatch(/opacity:\s*0|visibility:\s*hidden/);
    expect(MOTION_MS.normal).toBe(200);
  });

  it("imports public landing motion styles from globals", () => {
    const globalsPath = resolve(process.cwd(), "src/app/globals.css");
    const globals = readFileSync(globalsPath, "utf8");
    expect(globals).toContain("public-landing-motion.css");
  });
});
