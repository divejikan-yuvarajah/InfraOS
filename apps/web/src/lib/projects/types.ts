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
  availableActions?: ("SUBMIT" | "HOLD" | "RESUME" | "REOPEN")[];
  submissionGaps?: string[];
  availableReviewActions?: ("BEGIN_REVIEW" | "APPROVE" | "REJECT" | "RETURN_FOR_CHANGES")[];
  reviewDecision?: { status: string; reason: string; at: string } | null;
  budget?: { amountMinor: number; currency: "LKR" };
};

export type ReviewQueuePayload = {
  success: true;
  data: ProjectListPayload["data"] & { counts: { submitted: number; underReview: number } };
};

export type ReviewHistoryItem = {
  action: "project.review_started" | "project.approved" | "project.rejected" | "project.returned" | "project.reopened";
  status: string;
  reason: string | null;
  userId: string;
  at: string;
  requestId: string | null;
};

export type ReviewDetail = {
  project: ProjectDetail;
  submission: { found: true; userId: string; at: string } | { found: false };
  decisions: ReviewHistoryItem[];
};

export type ReviewDetailPayload = { success: true; data: ReviewDetail };

export type ProjectDetailPayload = {
  success: true;
  data: { project: ProjectDetail };
};
