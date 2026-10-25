import type { Permission } from "@infraos/shared-types";

export type RoleAdminDto = {
  id: string;
  key: string;
  name: string;
  description: string;
  scopeType: string;
  isSystem: true;
  isActive: boolean;
  permissions: Permission[];
  revision: number;
  assignedUserCount: number;
};

export type PermissionCatalogGroup = {
  module: string;
  permissions: Permission[];
};

export type RoleAdminFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 503;
  code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE";
};

export type RoleAdminSuccess = { ok: true; role: RoleAdminDto };
