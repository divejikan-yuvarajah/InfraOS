export type AdminUserRecord = {
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

export type AdminUserListPayload = {
  success: true;
  data: {
    users: AdminUserRecord[];
    page: number;
    pageSize: number;
    total: number;
  };
};

export type AdminUserPayload = {
  success: true;
  data: {
    user: AdminUserRecord;
    activationDelivery?: "BLOCKED";
    notice?: string;
  };
};
