/**
 * Shared cross-app TypeScript contracts.
 *
 * Only types used by more than one app belong here.
 * Mongoose models stay in apps/api. Do not add passwordHash or tokenHash here.
 */

export {
  AGENCY_STATUSES,
  AGENCY_TYPES,
  SCOPE_TYPES,
  SYSTEM_ROLE_KEYS,
  USER_STATUSES,
  type AgencyStatus,
  type AgencyType,
  type ScopeType,
  type SystemRoleKey,
  type UserStatus,
} from "./identity.js";

export {
  PERMISSION_CATALOG,
  PERMISSION_SET,
  isPermission,
  isPermissionFormat,
  type Permission,
} from "./permissions.js";
