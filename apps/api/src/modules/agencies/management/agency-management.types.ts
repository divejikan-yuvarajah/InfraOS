export type AgencyDto = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  type: string;
  status: string;
  parentAgencyId: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  revision: number;
};

export type AgencyImpact = {
  activeChildren: number;
  activeUsers: number;
  projects: number;
  workRequests: number;
};

export type AgencyList = {
  agencies: AgencyDto[];
  page: number;
  pageSize: number;
  total: number;
};

export type AgencyFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 503;
  code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE";
  details?: AgencyImpact | null;
};

export type AgencySuccess = { ok: true; agency: AgencyDto };
