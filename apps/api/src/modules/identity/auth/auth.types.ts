export type AuthUserDto = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  roleKey: string;
  agencyId: string | null;
  status: "ACTIVE";
  emailVerified: true;
};

export type AuthSessionDto = {
  user: AuthUserDto;
  accessToken: string;
  accessTokenExpiresInSeconds: number;
};

export type IssuedRefreshSession = {
  session: AuthSessionDto;
  refreshToken: string;
  refreshExpiresAt: Date;
};
