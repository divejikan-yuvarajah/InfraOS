import { describe, expect, it } from "vitest";

import { PUBLIC_LOCALES, PUBLIC_LOCALE_LABELS, PUBLIC_LOCALE_NAV_ORDER } from "./locales";
import { getLpCopy } from "./lp-copy";
import { getLpLinks, LP_DEFAULT_STAGE_INDEX, LP_DISPATCH_ROWS, LP_INCIDENT_LANES } from "./lp-data";

describe("INFRAOS landing page data & trilingual copy", () => {
  it("exposes English, Sinhala and Tamil in the exact selector order", () => {
    expect(PUBLIC_LOCALE_NAV_ORDER).toEqual(["en", "si", "ta"]);
    expect(PUBLIC_LOCALE_LABELS).toEqual({
      en: "English",
      si: "සිංහල",
      ta: "தமிழ்",
    });
  });

  it("wires the Authorized Portal / Sign In CTA to /login (and locale login routes)", () => {
    expect(getLpLinks("en").signIn).toBe("/login");
    for (const locale of PUBLIC_LOCALES) {
      const links = getLpLinks(locale);
      expect(links.signIn.endsWith("/login")).toBe(true);
      expect(links.home).toBe(locale === "en" ? "/" : `/${locale}`);
    }
  });

  it("provides complete trilingual copy for all 10 sections without empty strings", () => {
    const enCopy = getLpCopy("en");
    for (const locale of PUBLIC_LOCALES) {
      const copy = getLpCopy(locale);
      expect(copy.nav.signIn.length).toBeGreaterThan(0);
      expect(copy.hero.stats).toHaveLength(3);
      expect(copy.problem.beforeItems).toHaveLength(3);
      expect(copy.problem.afterItems).toHaveLength(3);
      expect(copy.lifecycle.stages).toHaveLength(8);
      expect(copy.incident.lanes).toHaveLength(3);
      expect(copy.capabilities.cards).toHaveLength(5);
      expect(copy.dispatch.columns).toHaveLength(5);
      expect(copy.audiences.cards).toHaveLength(3);
      expect(copy.transparency.items).toHaveLength(3);
      expect(copy.transparency.cadenceItems).toHaveLength(3);
      expect(copy.footer.platformLinks).toHaveLength(enCopy.footer.platformLinks.length);
    }
  });

  it("renders all 8 lifecycle stages in exact statutory sequence and defaults to Coordinate (stage 02)", () => {
    const stages = getLpCopy("en").lifecycle.stages;
    expect(stages.map((s) => s.name)).toEqual([
      "Plan",
      "Coordinate",
      "Approve",
      "Build",
      "Verify",
      "Monitor",
      "Complete",
      "Maintain",
    ]);
    expect(LP_DEFAULT_STAGE_INDEX).toBe(1);
    expect(stages[LP_DEFAULT_STAGE_INDEX]?.name).toBe("Coordinate");
  });

  it("defines 3 incident simulation lanes with collision and re-sequenced states", () => {
    const incident = getLpCopy("en").incident;
    expect(LP_INCIDENT_LANES).toHaveLength(3);
    expect(LP_INCIDENT_LANES.map((l) => l.collision)).toEqual([false, true, true]);
    for (const lane of incident.lanes) {
      expect(lane.bar.length).toBeGreaterThan(0);
      expect(lane.resequencedBar.length).toBeGreaterThan(0);
    }
  });

  it("defines 3 conceptual dispatch rows and all 3 status tags (locked, pending, blocked)", () => {
    expect(LP_DISPATCH_ROWS).toHaveLength(3);
    expect(LP_DISPATCH_ROWS.map((row) => row.status)).toEqual(["locked", "pending", "blocked"]);
    for (const locale of PUBLIC_LOCALES) {
      const status = getLpCopy(locale).dispatch.status;
      expect(status.locked.length).toBeGreaterThan(0);
      expect(status.pending.length).toBeGreaterThan(0);
      expect(status.blocked.length).toBeGreaterThan(0);
    }
  });
});
