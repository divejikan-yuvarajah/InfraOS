export const ACTIVITY_SOURCE_CAP = 200;

export const PROJECT_ACTIVITY_ACTIONS = [
  "project.created",
  "project.updated",
  "project.submitted",
  "project.status_changed",
  "project.review_started",
  "project.approved",
  "project.rejected",
  "project.returned",
  "project.reopened",
  "project.dependency_linked",
  "project.dependency_removed",
  "progress.reported",
] as const;

export const MILESTONE_ACTIVITY_ACTIONS = [
  "milestone.created",
  "milestone.updated",
  "milestone.status_changed",
] as const;

export type ActivityCategory = "project" | "milestone" | "progress" | "dependency";
export type ActivityFilter = "all" | ActivityCategory;

export type ActivityActor = { label: "Authorized staff" | "System event"; identityVisible: false };

export type ActivityItem = {
  id: string;
  kind: string;
  category: ActivityCategory;
  occurredAt: string;
  source: "audit" | "recorded_report" | "record_metadata";
  titleKey: string;
  actor: ActivityActor;
  detail: Record<string, string | number | boolean | null> | null;
};

const KINDS: Record<string, { kind: string; category: ActivityCategory; titleKey: string }> = {
  "project.created": { kind: "PROJECT_CREATED", category: "project", titleKey: "activity.projectCreated" },
  "project.updated": { kind: "PROJECT_UPDATED", category: "project", titleKey: "activity.projectUpdated" },
  "project.submitted": { kind: "PROJECT_SUBMITTED", category: "project", titleKey: "activity.projectSubmitted" },
  "project.status_changed": { kind: "PROJECT_STATUS_CHANGED", category: "project", titleKey: "activity.projectStatusChanged" },
  "project.review_started": { kind: "PROJECT_REVIEW_STARTED", category: "project", titleKey: "activity.projectReviewStarted" },
  "project.approved": { kind: "PROJECT_APPROVED", category: "project", titleKey: "activity.projectApproved" },
  "project.rejected": { kind: "PROJECT_REJECTED", category: "project", titleKey: "activity.projectRejected" },
  "project.returned": { kind: "PROJECT_RETURNED", category: "project", titleKey: "activity.projectReturned" },
  "project.reopened": { kind: "PROJECT_REOPENED", category: "project", titleKey: "activity.projectReopened" },
  "project.dependency_linked": { kind: "DEPENDENCY_LINKED", category: "dependency", titleKey: "activity.dependencyLinked" },
  "project.dependency_removed": { kind: "DEPENDENCY_REMOVED", category: "dependency", titleKey: "activity.dependencyRemoved" },
  "progress.reported": { kind: "PROGRESS_REPORTED", category: "progress", titleKey: "activity.progressReported" },
  "milestone.created": { kind: "MILESTONE_CREATED", category: "milestone", titleKey: "activity.milestoneCreated" },
  "milestone.updated": { kind: "MILESTONE_UPDATED", category: "milestone", titleKey: "activity.milestoneUpdated" },
  "milestone.status_changed": { kind: "MILESTONE_STATUS_CHANGED", category: "milestone", titleKey: "activity.milestoneStatusChanged" },
};

export function classifyActivityAction(action: string): { kind: string; category: ActivityCategory; titleKey: string } | null {
  return KINDS[action] ?? null;
}

export function activityActor(hasUser: boolean): ActivityActor {
  return hasUser
    ? { label: "Authorized staff", identityVisible: false }
    : { label: "System event", identityVisible: false };
}

export function compareActivity(left: ActivityItem, right: ActivityItem): number {
  if (left.occurredAt !== right.occurredAt) return left.occurredAt < right.occurredAt ? 1 : -1;
  if (left.id !== right.id) return left.id < right.id ? 1 : -1;
  return 0;
}

export type ActivityCursor = { t: string; id: string };

export function encodeActivityCursor(item: Pick<ActivityItem, "occurredAt" | "id">): string {
  return Buffer.from(JSON.stringify({ t: item.occurredAt, id: item.id }), "utf8").toString("base64url");
}

export function decodeActivityCursor(value: string): ActivityCursor | null {
  if (value.length > 240) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "t" && key !== "id")) return null;
  if (typeof record.t !== "string" || Number.isNaN(Date.parse(record.t))) return null;
  if (typeof record.id !== "string" || !/^(audit|report|record):[a-f0-9]{24}$/i.test(record.id)) return null;
  return { t: new Date(record.t).toISOString(), id: record.id };
}

export function isAfterCursor(item: ActivityItem, cursor: ActivityCursor): boolean {
  if (item.occurredAt !== cursor.t) return item.occurredAt < cursor.t;
  return item.id < cursor.id;
}

export function pageActivities(items: ActivityItem[], cursor: ActivityCursor | null, limit: number): {
  activities: ActivityItem[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  const ordered = [...items].sort(compareActivity);
  const visible = cursor ? ordered.filter((item) => isAfterCursor(item, cursor)) : ordered;
  const page = visible.slice(0, limit);
  const hasMore = visible.length > limit;
  const last = page.at(-1);
  return { activities: page, nextCursor: hasMore && last ? encodeActivityCursor(last) : null, hasMore };
}
