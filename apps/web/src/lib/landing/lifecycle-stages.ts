/** Canonical INFRAOS lifecycle stage identifiers (stable across locales). */
export const LIFECYCLE_STAGE_IDS = [
  "plan",
  "coordinate",
  "approve",
  "build",
  "verify",
  "monitor",
  "complete",
  "maintain",
] as const;

export type LifecycleStageId = (typeof LIFECYCLE_STAGE_IDS)[number];
