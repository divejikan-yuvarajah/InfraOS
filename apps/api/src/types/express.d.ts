export {};

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      actor?: {
        userId: string;
        roleId: string;
        roleKey: string;
        agencyId: string;
        credentialEpoch: number;
      };
      authUser?: {
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
    }
  }
}
