/** JSON-safe identifiers. Persistence ObjectIds stay on the server. */
export type EntityId = string;

/** UTC ISO-8601 date-time, for example `2026-10-15T08:30:00.000Z`. */
export type IsoDateTimeString = string;

/**
 * Inclusive calendar-day policy for schedule overlap:
 * A overlaps B when A.start <= B.end AND A.end >= B.start.
 * Wire values are ISO date-times, not `Date` objects.
 */
export type ScheduleOverlapRule = "INCLUSIVE_INTERVAL";

export const SCHEDULE_OVERLAP_RULE = "INCLUSIVE_INTERVAL" as const;

/** LKR minor units (cents). Never rupees-as-floats on the wire. */
export interface MoneyDto {
  amountMinor: number;
  currency: "LKR";
}

export const SUPPORTED_CURRENCIES = ["LKR"] as const;

/** 0–100 inclusive. Same scale as Mongoose percentage fields. */
export type PercentageScore = number;

export const PERCENTAGE_MIN = 0;
export const PERCENTAGE_MAX = 100;

/** RoadSync measured distance. Metres, not degrees. */
export type DistanceMeters = number;

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
} as const;
