export type AdminRegistrationRecord = {
  id: string;
  referenceCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  organizationCode: string;
  organizationName: string;
  department: string;
  designation: string;
  requestedResponsibility: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  accountStatus: "pending" | "approved" | "rejected";
  acceptedTermsAt: string;
  createdAt: string;
  reviewedBy?: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  approvalNotes?: string | null;
  assignedRole?: {
    id: string;
    key: string;
    name: string;
  } | null;
  assignedAgency?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdUserId?: string | null;
};

export type AdminRegistrationCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type AdminRegistrationListPayload = {
  items: AdminRegistrationRecord[];
  total: number;
  page: number;
  limit: number;
  counts: AdminRegistrationCounts;
};

export type AdminRegistrationApproveInput = {
  roleKey: string;
  agencyCode?: string;
  agencyId?: string;
  notes?: string;
};

export type AdminRegistrationRejectInput = {
  reason: string;
};

