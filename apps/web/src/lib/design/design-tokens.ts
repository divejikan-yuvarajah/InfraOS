/**
 * Non-color design tokens for TS consumers (Step 18).
 * CSS source: typography-tokens.css, layout-tokens.css, tokens.css (--radius).
 */

export const FONT_STACK = {
  sans: 'var(--font-family-sans)',
  mono: 'var(--font-family-mono)',
} as const;

export const CONTAINER_MAX = {
  prose: "42rem",
  form: "32rem",
  content: "48rem",
  dashboard: "90rem",
  full: "100%",
} as const;

export const Z_INDEX = {
  base: 0,
  sticky: 20,
  mapControls: 30,
  dropdown: 40,
  overlay: 50,
  modal: 50,
  toast: 60,
  skipLink: 70,
} as const;

export const MOTION_MS = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

/** Sample strings for manual mixed-script rendering checks (not i18n). */
export const MIXED_SCRIPT_SAMPLES = {
  agencyEn:
    "Road Development Authority — Western Province Corridor Coordination Unit",
  agencyTa: "சாலை அபிவிருத்தி அதிகாரசபை",
  agencySi: "මහාමාර්ග අධිකාරිය",
  projectEn: "Colombo Outer Circular Expressway — Segment 3 Resurfacing",
} as const;
