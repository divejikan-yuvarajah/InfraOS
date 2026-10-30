export const NOTICE_ACTIONS = [
  "project.submitted",
  "project.review_started",
  "project.approved",
  "project.rejected",
  "project.returned",
  "project.status_changed",
  "project.reopened",
  "milestone.created",
  "milestone.updated",
  "milestone.status_changed",
] as const;

export type NoticeAction = (typeof NOTICE_ACTIONS)[number];

const REVIEWER_ACTIONS = new Set<NoticeAction>(["project.submitted"]);

export function isNoticeAction(action: string): action is NoticeAction {
  return (NOTICE_ACTIONS as readonly string[]).includes(action);
}

export function noticeAudience(action: NoticeAction): "reviewer" | "manager" {
  return REVIEWER_ACTIONS.has(action) ? "reviewer" : "manager";
}

export function noticeType(action: NoticeAction): "APPROVAL" | "MILESTONE" | "SYSTEM" {
  if (action.startsWith("milestone.")) return "MILESTONE";
  if (action === "project.status_changed" || action === "project.reopened") return "SYSTEM";
  return "APPROVAL";
}

export function encodeNoticeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt, id }), "utf8").toString("base64url");
}

export function decodeNoticeCursor(value: string): { t: string; id: string } | null {
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
  if (typeof record.id !== "string" || !/^[a-f0-9]{24}$/i.test(record.id)) return null;
  return { t: new Date(record.t).toISOString(), id: record.id };
}
