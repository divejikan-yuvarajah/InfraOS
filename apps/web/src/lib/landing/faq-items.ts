/** Stable FAQ identifiers for Step 31 (locale-independent keys). */
export const FAQ_ITEM_IDS = [
  "what-is-infraos",
  "official-government",
  "who-for",
  "projecttrace",
  "roadsync-conflicts",
  "public-projects-now",
  "citizen-reporting",
  "staff-access",
  "languages",
] as const;

export type FaqItemId = (typeof FAQ_ITEM_IDS)[number];

export const TRUST_SECTION_ANCHOR = "trust-information";
export const FAQ_SECTION_ANCHOR = "faq";
export const NEXT_STEPS_SECTION_ANCHOR = "next-steps";

export type NextStepAnchor = "features" | "lifecycle" | "preview";
