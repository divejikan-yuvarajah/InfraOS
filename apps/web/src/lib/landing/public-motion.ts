/**
 * Step 33 public landing motion policy (CSS-first; no GSAP on this checkpoint).
 */

export const PUBLIC_LANDING_MOTION_POLICY = {
  approach: "css-tokens-only" as const,
  gsapInstalled: false,
  smoothScroll: "html:focus-within when prefers-reduced-motion: no-preference",
  contentVisibility: "ssr-visible-without-js",
} as const;
