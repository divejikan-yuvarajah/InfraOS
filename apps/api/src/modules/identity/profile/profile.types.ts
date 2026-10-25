export type SelfProfileDto = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  emailVerified: true;
  status: "ACTIVE";
  roleKey: string;
  agencyId: string | null;
  agencyName: string | null;
  lastLoginAt: string | null;
  revision: number;
};
