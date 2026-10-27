export const REVIEW_ACTIONS = ["BEGIN_REVIEW", "APPROVE", "REJECT", "RETURN_FOR_CHANGES"] as const;

export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

const EDGES: Record<ReviewAction, Partial<Record<string, "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DRAFT">>> = {
  BEGIN_REVIEW: { SUBMITTED: "UNDER_REVIEW" },
  APPROVE: { UNDER_REVIEW: "APPROVED" },
  REJECT: { SUBMITTED: "REJECTED", UNDER_REVIEW: "REJECTED" },
  RETURN_FOR_CHANGES: { UNDER_REVIEW: "DRAFT" },
};

export function isReviewAction(value: string): value is ReviewAction {
  return (REVIEW_ACTIONS as readonly string[]).includes(value);
}

export function reviewTarget(from: string, action: ReviewAction): "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DRAFT" | null {
  return EDGES[action][from] ?? null;
}

export function reviewNeedsReason(action: ReviewAction): boolean {
  return action === "REJECT" || action === "RETURN_FOR_CHANGES";
}

/** Terminal review decisions cannot be made by the trusted submitter. */
export function reviewSeparatesDuties(action: ReviewAction): boolean {
  return action === "APPROVE" || action === "REJECT" || action === "RETURN_FOR_CHANGES";
}
