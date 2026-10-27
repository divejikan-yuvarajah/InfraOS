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

export type ProjectListAgency = { id: string; code: string | null };

export type ProjectListPayload = {
  success: true;
  data: {
    projects: ProjectSummary[];
    page: number;
    limit: number;
    total: number;
    agencies?: ProjectListAgency[];
  };
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
  actualEndDate?: string | null;
  physicalProgress?: number | null;
  managerName?: string | null;
  canEditDraft?: boolean;
  availableActions?: ("SUBMIT" | "HOLD" | "RESUME")[];
  submissionGaps?: string[];
  budget?: { amountMinor: number; currency: "LKR" };
};

export type ProjectDetailPayload = {
  success: true;
  data: { project: ProjectDetail };
};
