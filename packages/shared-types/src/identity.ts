/** Locked Step 4 role codes. Display names may change; keys must not. */
export const SYSTEM_ROLE_KEYS = [
  "SUPER_ADMIN",
  "GOV_ADMIN",
  "AGENCY_OFFICER",
  "PROJECT_MANAGER",
  "CONTRACTOR",
  "INSPECTOR",
  "CITIZEN",
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const USER_STATUSES = [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "DISABLED",
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const SCOPE_TYPES = [
  "PLATFORM",
  "ORGANIZATION",
  "AGENCY",
  "ASSIGNED_PROJECT",
  "ASSIGNED_INSPECTION",
  "OWN_RECORD",
  "PUBLIC",
] as const;

export type ScopeType = (typeof SCOPE_TYPES)[number];

export const AGENCY_TYPES = [
  "MINISTRY",
  "DEPARTMENT",
  "ROAD",
  "WATER",
  "ELECTRICITY",
  "TELECOM",
  "LOCAL_AUTHORITY",
  "DRAINAGE",
  "OTHER",
] as const;

export type AgencyType = (typeof AGENCY_TYPES)[number];

export const AGENCY_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type AgencyStatus = (typeof AGENCY_STATUSES)[number];
