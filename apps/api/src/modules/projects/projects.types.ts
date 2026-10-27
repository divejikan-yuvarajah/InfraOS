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
  actualEndDate: string | null;
  physicalProgress: number | null;
  managerName: string | null;
  /** Scope-checked draft edit capability for the current actor. PATCH remains authoritative. */
  canEditDraft?: boolean;
  /** Executable lifecycle actions for this actor and status. Hints only. */
  availableActions?: ("SUBMIT" | "HOLD" | "RESUME" | "REOPEN")[];
  /** Missing DRAFT submission requirements. Present only when the actor may submit. */
  submissionGaps?: string[];
  /** Reviewer hints. The review endpoint reauthorizes every write. */
  availableReviewActions?: ("BEGIN_REVIEW" | "APPROVE" | "REJECT" | "RETURN_FOR_CHANGES")[];
  /** Latest reject or return reason visible to a reader who can already see this project. */
  reviewDecision?: { status: string; reason: string; at: string } | null;
  budget?: { amountMinor: number; currency: "LKR" };
};

export type ProjectListAgencyDto = {
  id: string;
  code: string | null;
};

export type ReviewQueueDto = ProjectListDto & {
  counts: { submitted: number; underReview: number };
};

export type ReviewHistoryDto = {
  action: "project.review_started" | "project.approved" | "project.rejected" | "project.returned" | "project.reopened";
  status: string;
  reason: string | null;
  userId: string;
  at: string;
  requestId: string | null;
};

export type ReviewDetailDto = {
  project: ProjectDetailDto;
  submission: { found: true; userId: string; at: string } | { found: false };
  decisions: ReviewHistoryDto[];
};

export type ProjectListDto = {
  projects: ProjectSummaryDto[];
  page: number;
  limit: number;
  total: number;
  agencies: ProjectListAgencyDto[];
};

export type ProjectFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 503;
  code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "SERVICE_UNAVAILABLE";
};
