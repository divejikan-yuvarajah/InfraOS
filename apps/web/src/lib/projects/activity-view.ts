import type { AuthLocale } from "@/lib/auth/types";

export type ActivityCategory = "project" | "milestone" | "progress" | "dependency";
export type ActivityFilter = "all" | ActivityCategory;

export type ActivityViewItem = {
  id: string;
  kind: string;
  category: ActivityCategory;
  occurredAt: string;
  source: "audit" | "recorded_report" | "record_metadata";
  titleKey: string;
  actor: { label: "Authorized staff" | "System event"; identityVisible: false };
  detail: Record<string, string | number | boolean | null> | null;
};

const LINK_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);

export function canLinkActivity(roleKey: string): boolean {
  return LINK_ROLES.has(roleKey);
}

export function activityQueryKey(epoch: string, userId: string, roleKey: string, projectId: string, category: ActivityFilter, cursor: string) {
  return ["activity", epoch, userId, roleKey, projectId, category, cursor] as const;
}

export function activityScope(epoch: string, userId: string, roleKey: string, projectId: string): string {
  return [epoch, userId, roleKey, projectId].join(":");
}

export type ActivityPageState = {
  scope: string;
  cursor?: string;
  pages: ActivityViewItem[];
};

export function activityPageState(scope: string): ActivityPageState {
  return { scope, pages: [] };
}

/** Drop accumulated rows when the signed-in person, epoch, role, or project changes. */
export function activityPagesForScope(state: ActivityPageState, scope: string): ActivityPageState {
  return state.scope === scope ? state : activityPageState(scope);
}

export function visibleActivityItems(state: ActivityPageState, scope: string, signedIn: boolean, current: ActivityViewItem[]): ActivityViewItem[] {
  if (!signedIn || state.scope !== scope) return [];
  return state.cursor ? [...state.pages, ...current] : current;
}

export function rememberActivityPage(state: ActivityPageState, scope: string, shown: ActivityViewItem[], nextCursor: string | null): ActivityPageState {
  if (state.scope !== scope || !nextCursor) return state;
  return { scope, cursor: nextCursor, pages: shown };
}

export function formatActivityWhen(iso: string, locale: AuthLocale): string {
  const tag = locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK";
  return new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(iso));
}
