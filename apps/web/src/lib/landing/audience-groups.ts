/** Stable audience group identifiers for Step 29 public copy. */
export const AUDIENCE_GROUP_IDS = [
  "citizens",
  "agency-teams",
  "field-teams",
  "visitors",
] as const;

export type AudienceGroupId = (typeof AUDIENCE_GROUP_IDS)[number];

/** In-page section anchors for safe “read next” links (not routes). */
export type AudienceActionAnchor =
  | "solution"
  | "features"
  | "lifecycle"
  | "problem";
