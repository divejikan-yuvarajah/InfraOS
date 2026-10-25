export type ProjectSummaryDto = {
  id: string;
  projectCode: string;
  title: string;
  projectType: string;
  status: string;
  agencyId: string;
  agencyCode: string | null;
  managerId: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type ProjectDetailDto = ProjectSummaryDto & {
  description: string | null;
  location: {
    district?: string;
    province?: string;
    locality?: string;
    roadName?: string;
    description?: string;
  } | null;
  geometry: { type: string; coordinates: unknown } | null;
  budget?: { amountMinor: number; currency: "LKR" };
};

export type ProjectListDto = {
  projects: ProjectSummaryDto[];
  page: number;
  limit: number;
  total: number;
};

export type ProjectFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 503;
  code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE";
};
