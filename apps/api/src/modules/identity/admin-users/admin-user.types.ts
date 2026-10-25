export type AdminUserDto = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  status: string;
  emailVerified: boolean;
  roleKey: string;
  agencyId: string | null;
  agencyName: string | null;
  revision: number;
};

export type AdminUserList = {
  users: AdminUserDto[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminUserFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 503;
  code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE";
};

export type AdminUserSuccess = {
  ok: true;
  user: AdminUserDto;
  activationDelivery?: "BLOCKED";
};
