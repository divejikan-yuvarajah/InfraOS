/** Stable demo identifiers for upserts, verification, and safe reset. */

export const DEMO_LAYER_AGENCY_CODES = [
  "AGENCY_DEMO_TELECOM",
  "AGENCY_DEMO_DRAINAGE",
  "AGENCY_DEMO_LOCAL",
  "AGENCY_DEMO_PLANNING",
] as const;

export const CORE_DEMO_AGENCY_CODES = [
  "DEMO_MINISTRY",
  "DEMO_RDA",
  "DEMO_WATER",
  "DEMO_ELEC",
] as const;

export const DEMO_PROJECT_CODES = [
  "INF-ROAD-001",
  "INF-WATER-001",
  "INF-TELECOM-001",
  "INF-DRAINAGE-001",
  "INF-PFAC-001",
  "INF-BRIDGE-001",
  "INF-DRAFT-001",
] as const;

export type DemoProjectCode = (typeof DEMO_PROJECT_CODES)[number];

export const DEMO_CONTRACTOR_REGS = [
  "SYNTH/ALPHA-001",
  "SYNTH/BETA-001",
  "SYNTH/GAMMA-001",
] as const;

export const DEMO_MILESTONE_TITLES = [
  "Drainage Preparation",
  "Road Base Preparation",
  "Asphalt Work",
  "Road Marking",
] as const;

export const WORK_SEED_KEYS = {
  ROAD_CORRIDOR: "WORK_DEMO_ROAD_CORRIDOR",
  WATER_CORRIDOR: "WORK_DEMO_WATER_CORRIDOR",
  FAR_CONTROL: "WORK_DEMO_FAR_CONTROL",
  SCHEDULE_CONTROL: "WORK_DEMO_SCHEDULE_CONTROL",
  NEARBY_PARALLEL: "WORK_DEMO_NEARBY_PARALLEL",
  TELECOM_PLANNED: "WORK_DEMO_TELECOM_PLANNED",
} as const;

export type WorkSeedKey = (typeof WORK_SEED_KEYS)[keyof typeof WORK_SEED_KEYS];

export const SPATIAL_VERIFY = {
  probePoint: [79.8612, 6.9271] as [number, number],
  probeEnd: new Date("2026-05-01T00:00:00.000Z"),
  probeStart: new Date("2026-03-01T00:00:00.000Z"),
  maxDistanceMeters: 2_000,
} as const;
