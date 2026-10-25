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

export type ProjectDetailPayload = {
  success: true;
  data: { project: ProjectSummary & { description: string | null; budget?: { amountMinor: number; currency: "LKR" } } };
};
