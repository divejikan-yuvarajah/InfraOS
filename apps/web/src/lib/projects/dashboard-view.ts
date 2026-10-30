export type DashboardStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "APPROVED"
  | "ACTIVE"
  | "ON_HOLD"
  | "DELAYED"
  | "COMPLETED"
  | "CANCELLED";

export type DashboardPayload = {
  asOf: string;
  timezone: "Asia/Colombo";
  scope: "platform" | "agency" | "assigned";
  coverage: {
    projects: "complete";
    milestones: "complete" | "unavailable";
    reviews: "complete" | "unavailable";
    finance: "complete" | "unavailable" | "withheld";
  };
  counts: {
    total: number;
    byStatus: Record<DashboardStatus, number>;
    active: number;
    onHold: number;
    delayed: number;
  };
  recentProjects: { id: string; projectCode: string; title: string; status: string; updatedAt: string }[];
  physical: {
    reportedAt100StillNotCompleted: number;
    completedByStatus: number;
    meaning: "physical_progress_does_not_set_status";
  };
  milestones: null | {
    overdue: number;
    dueWithin14Days: number;
    items: { id: string; projectId: string; projectCode: string; projectTitle: string; title: string; status: string; plannedEnd: string; classification: "overdue" | "due"; meaning: "planned_not_completed" }[];
    meaning: "planned_not_completed";
  };
  reviews: null | { pending: number; items: { id: string; projectCode: string; title: string; status: string; updatedAt: string }[] };
  finance: null | { storedPaidCount: number; storedPaidAmountMinor: number; currency: "LKR"; provenance: "stored_record_provisional_not_bank_settlement" };
  assignedToYou: number | null;
  availableWidgets: string[];
};

const LINK_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);
const STATUSES: DashboardStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "CANCELLED"];

export function dashboardQueryKey(epoch: string, userId: string, roleKey: string) {
  return ["project-dashboard", epoch, userId, roleKey] as const;
}

export function dashboardScope(epoch: string, userId: string, roleKey: string): string {
  return [epoch, userId, roleKey].join(":");
}

export function visibleDashboard(payload: DashboardPayload | undefined, requestScope: string, scope: string, signedIn: boolean): DashboardPayload | null {
  if (!signedIn || requestScope !== scope || !payload) return null;
  return payload;
}

export function dashboardIsEmpty(payload: DashboardPayload): boolean {
  return payload.counts.total === 0 && payload.recentProjects.length === 0;
}

export function dashboardIsPartial(payload: DashboardPayload): boolean {
  return payload.coverage.milestones === "unavailable" || payload.coverage.finance === "unavailable";
}

export type DashboardCard = { id: string; value: number | null; tone: "neutral" | "active" | "hold" | "delayed" | "review" | "finance" };

export function dashboardCards(payload: DashboardPayload): DashboardCard[] {
  return [
    { id: "total", value: payload.counts.total, tone: "neutral" },
    { id: "active", value: payload.counts.active, tone: "active" },
    { id: "onHold", value: payload.counts.onHold, tone: "hold" },
    { id: "delayed", value: payload.counts.delayed, tone: "delayed" },
    { id: "reportedOpen", value: payload.physical.reportedAt100StillNotCompleted, tone: "neutral" },
    { id: "reviews", value: payload.reviews ? payload.reviews.pending : null, tone: "review" },
  ];
}

export function statusRows(payload: DashboardPayload): { status: DashboardStatus; count: number; width: number }[] {
  const max = Math.max(1, ...STATUSES.map((status) => payload.counts.byStatus[status]));
  return STATUSES.map((status) => ({ status, count: payload.counts.byStatus[status], width: Math.round((payload.counts.byStatus[status] / max) * 100) }));
}

export function canLinkProjectRecord(roleKey: string): boolean {
  return LINK_ROLES.has(roleKey);
}

export function dashboardLinks(roleKey: string, payload: DashboardPayload | null): { href: string; id: string }[] {
  const links = [{ href: "/projects", id: "projects" }];
  if (payload?.reviews) links.push({ href: "/projects/reviews", id: "reviews" });
  const recent = payload?.recentProjects[0];
  if (recent) {
    links.push({ href: `/projects/${recent.id}`, id: "overview" });
    if (canLinkProjectRecord(roleKey)) {
      links.push({ href: `/projects/${recent.id}/timeline`, id: "timeline" });
      links.push({ href: `/projects/${recent.id}/activity`, id: "activity" });
    }
  }
  return links;
}
