/**
 * Fixed demo calendar (Step 15). All synthetic schedules reference these UTC instants
 * so screenshots and verification stay repeatable. Do not mix relative dates.
 */
export const DEMO_ANCHOR = new Date("2026-04-01T00:00:00.000Z");

export const d = (iso: string): Date => new Date(iso);

export const demoDates = {
  roadStart: d("2026-01-01T00:00:00.000Z"),
  roadEnd: d("2026-06-30T00:00:00.000Z"),
  waterStart: d("2026-02-15T00:00:00.000Z"),
  waterEnd: d("2026-07-31T00:00:00.000Z"),
  wrRoadStart: d("2026-01-10T00:00:00.000Z"),
  wrRoadEnd: d("2026-04-20T00:00:00.000Z"),
  wrWaterStart: d("2026-03-01T00:00:00.000Z"),
  wrWaterEnd: d("2026-05-01T00:00:00.000Z"),
  wrFarStart: d("2026-03-01T00:00:00.000Z"),
  wrFarEnd: d("2026-05-01T00:00:00.000Z"),
  wrNonOverlapStart: d("2027-01-01T00:00:00.000Z"),
  wrNonOverlapEnd: d("2027-02-01T00:00:00.000Z"),
  wrNearbyStart: d("2026-03-15T00:00:00.000Z"),
  wrNearbyEnd: d("2026-04-30T00:00:00.000Z"),
  delayedStart: d("2025-06-01T00:00:00.000Z"),
  delayedEnd: d("2026-06-01T00:00:00.000Z"),
  completedStart: d("2024-01-01T00:00:00.000Z"),
  completedEnd: d("2025-12-15T00:00:00.000Z"),
  bridgeCommissioned: d("2025-12-20T00:00:00.000Z"),
  inspectionScheduled: d("2026-04-15T00:00:00.000Z"),
  inspectionVerified: d("2026-03-10T00:00:00.000Z"),
  payment1: d("2026-02-01T00:00:00.000Z"),
  payment2: d("2026-03-01T00:00:00.000Z"),
  maintenanceCompleted: d("2026-01-15T00:00:00.000Z"),
  maintenanceUpcoming: d("2026-08-01T00:00:00.000Z"),
} as const;
