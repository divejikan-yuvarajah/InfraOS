export type RoleRecord = {
  id: string;
  key: string;
  name: string;
  description: string;
  scopeType: string;
  isSystem: true;
  isActive: boolean;
  permissions: string[];
  revision: number;
  assignedUserCount: number;
};

export type RoleListPayload = { success: true; data: { roles: RoleRecord[] } };
export type RolePayload = { success: true; data: { role: RoleRecord } };
export type CatalogPayload = { success: true; data: { catalog: { module: string; permissions: string[] }[] } };
