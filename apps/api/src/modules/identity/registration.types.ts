import type { SystemRoleKey } from "@infraos/shared-types";

/** Built only inside the API process. HTTP handlers must not construct this. */
export type TrustedProvisioningActor = {
  source: "server-internal";
  capability: "identity.provision";
  actorUserId: string | null;
};

export type StaffProvisionInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleKey: SystemRoleKey;
  agencyCode: string | null;
};

export type ProvisionedUserDto = {
  id: string;
  status: "PENDING";
  emailVerified: false;
  roleKey: SystemRoleKey;
  agencyId: string | null;
  nextAction: "VERIFY_EMAIL";
};

export type ProvisionAuditEvent = {
  action: "identity.user.provisioned";
  actorSource: "server-internal";
  actorUserId: string | null;
  targetUserId: string;
  roleKey: SystemRoleKey;
  agencyId: string | null;
};

export type StaffProvisionResult = {
  user: ProvisionedUserDto;
  audit: ProvisionAuditEvent;
};
