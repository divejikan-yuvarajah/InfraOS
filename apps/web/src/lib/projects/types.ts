export type ProjectSummary = {
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

export type ProjectListPayload = {
  success: true;
  data: { projects: ProjectSummary[]; page: number; limit: number; total: number };
};

export type ProjectLocation = {
  district?: string;
  province?: string;
  locality?: string;
  roadName?: string;
  description?: string;
};

export type ProjectDetail = ProjectSummary & {
  description: string | null;
  location?: ProjectLocation | null;
  geometry?: { type: string; coordinates: unknown } | null;
  budget?: { amountMinor: number; currency: "LKR" };
};

export type ProjectDetailPayload = {
  success: true;
  data: { project: ProjectDetail };
};
