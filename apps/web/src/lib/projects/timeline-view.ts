import type { AuthLocale } from "@/lib/auth/types";

export type TimelinePrecision = "timestamp" | "date";
export type TimelineSourceKind = "project" | "milestone" | "progressReport";
export type TimelineGroup = "all" | "project" | "milestone" | "progress";

export type TimelineViewEntry = {
  id: string;
  sourceKind: TimelineSourceKind;
  sourceId: string;
  eventDate: string;
  precision: TimelinePrecision;
  category: "planned" | "recorded";
  titleKey: string;
  dateRole: string;
  status?: string;
  reportedPercent?: number;
  note?: string;
  label?: string;
};

export type TimelineAvailability = "visible" | "restricted" | "unavailable";

const LOCALE_TAG: Record<AuthLocale, string> = {
  en: "en-LK",
  si: "si-LK",
  ta: "ta-LK",
};

const TIMELINE_LINK_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);

export function canLinkTimeline(roleKey: string): boolean {
  return TIMELINE_LINK_ROLES.has(roleKey);
}

export function timelineQueryKey(
  epoch: string,
  userId: string,
  roleKey: string,
  projectId: string,
  group: TimelineGroup,
  sort: "asc" | "desc",
  page: number,
): readonly [string, string, string, string, string, TimelineGroup, "asc" | "desc", number] {
  return ["project-timeline", epoch, userId, roleKey, projectId, group, sort, page];
}

export function formatTimelineWhen(value: string, precision: TimelinePrecision, locale: AuthLocale): string {
  const tag = LOCALE_TAG[locale] ?? LOCALE_TAG.en;
  if (precision === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return value;
    const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return new Intl.DateTimeFormat(tag, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(parsed);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(tag, {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function timelineHeading(value: string, precision: TimelinePrecision): string {
  if (precision === "date") return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}

export function groupTimeline(entries: readonly TimelineViewEntry[], group: TimelineGroup): TimelineViewEntry[] {
  if (group === "project") return entries.filter((entry) => entry.sourceKind === "project");
  if (group === "milestone") return entries.filter((entry) => entry.sourceKind === "milestone");
  if (group === "progress") return entries.filter((entry) => entry.sourceKind === "progressReport");
  return [...entries];
}

export function groupByHeading(entries: readonly TimelineViewEntry[]): { heading: string; entries: TimelineViewEntry[] }[] {
  const groups: { heading: string; entries: TimelineViewEntry[] }[] = [];
  for (const entry of entries) {
    const heading = timelineHeading(entry.eventDate, entry.precision);
    const current = groups[groups.length - 1];
    if (!current || current.heading !== heading) groups.push({ heading, entries: [entry] });
    else current.entries.push(entry);
  }
  return groups;
}

export function onTimelineKey(key: string, index: number, count: number): number {
  if (count <= 0) return 0;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return Math.min(count - 1, index + 1);
  if (key === "ArrowUp") return Math.max(0, index - 1);
  return index;
}

export type PlannedRange = {
  id: string;
  label: string;
  start: string;
  end: string;
  status?: string;
};

export function plannedRanges(entries: readonly TimelineViewEntry[]): PlannedRange[] {
  const byId = new Map<string, PlannedRange>();
  for (const entry of entries) {
    if (entry.sourceKind !== "milestone" || !entry.label) continue;
    const current = byId.get(entry.sourceId) ?? { id: entry.sourceId, label: entry.label, start: "", end: "", status: entry.status };
    if (entry.dateRole === "plannedMilestoneStart") current.start = entry.eventDate;
    if (entry.dateRole === "plannedMilestoneEnd") current.end = entry.eventDate;
    if (entry.status) current.status = entry.status;
    byId.set(entry.sourceId, current);
  }
  return [...byId.values()].filter((range) => range.start && range.end).sort((left, right) => left.start.localeCompare(right.start) || left.id.localeCompare(right.id));
}

export function visibleWhenRestricted(entry: TimelineViewEntry, milestone: TimelineAvailability, progress: TimelineAvailability): boolean {
  if (entry.sourceKind === "milestone" && milestone !== "visible") return false;
  if (entry.sourceKind === "progressReport" && progress !== "visible") return false;
  return true;
}
