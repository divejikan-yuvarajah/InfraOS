import { publicHomePath, publicInfoPath, type PublicLocale } from "./locales";
import type { LpStatusTone } from "./lp-copy";

/** In-page anchors for the landing page sections. */
export const LP_ANCHORS = {
  hero: "hero",
  lifecycle: "lifecycle",
  problem: "problem",
  incident: "incident",
  capabilities: "how-it-works",
  dispatch: "dispatch",
  audiences: "audiences",
  transparency: "status-panel",
} as const;

/** Conceptual coordination-matrix rows (sample data from the design export; not live data). */
export type LpDispatchRow = {
  road: string;
  lead: string;
  coApplicants: readonly string[];
  window: string;
  status: LpStatusTone;
};

export const LP_DISPATCH_ROWS: readonly LpDispatchRow[] = [
  {
    road: "A2 Galle Road (Kollupitiya)",
    lead: "RDA National",
    coApplicants: ["NWSDB", "SLT", "CEB"],
    window: "01 Oct – 14 Nov 2025",
    status: "locked",
  },
  {
    road: "B425 Horton Place",
    lead: "Colombo Municipal Council",
    coApplicants: ["CEB Grid 4", "Dialog Axiata"],
    window: "15 Nov – 28 Nov 2025",
    status: "pending",
  },
  {
    road: "AB10 Baseline Road (Orugodawatta)",
    lead: "RDA Western Region",
    coApplicants: ["Petroleum Pipeline Corp"],
    window: "01 Dec – 15 Jan 2026",
    status: "blocked",
  },
];

/** Incident lane geometry, as percentages of the 60-day axis in the design export. */
export const LP_INCIDENT_LANES = [
  { tone: "rda", left: 0, width: 33.333, collision: false },
  { tone: "nwsdb", left: 38, width: 25, collision: true },
  { tone: "slt", left: 62, width: 20, collision: true },
] as const;

export const LP_DEFAULT_STAGE_INDEX = 1;

export type LpLinks = {
  signIn: string;
  about: string;
  howItWorks: string;
  faq: string;
  contact: string;
  accessibility: string;
  privacy: string;
  home: string;
  capabilities: readonly string[];
};

/** Verified routes only. Locale-prefixed routes exist for the public pages and login. */
export function getLpLinks(locale: PublicLocale): LpLinks {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const howItWorks = publicInfoPath(locale, "how-it-works");
  return {
    home: publicHomePath(locale),
    signIn: `${prefix}/login`,
    about: publicInfoPath(locale, "about"),
    howItWorks,
    faq: publicInfoPath(locale, "faq"),
    contact: publicInfoPath(locale, "contact"),
    accessibility: publicInfoPath(locale, "accessibility"),
    privacy: publicInfoPath(locale, "privacy"),
    capabilities: ["/projects", "/roadsync/dashboard", howItWorks, "/roadsync/conflicts", howItWorks],
  };
}

