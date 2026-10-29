/**
 * Read-only timeline normalization. Step 62 dependencies are a typed slot only.
 * This module does not read or write Milestone, ProgressReport, or Project.
 */

export const TIMELINE_SOURCE_CAP = 100;

export const TIMELINE_DEPENDENCIES = { status: "not_implemented" } as const;

export type TimelineDependencySlot = typeof TIMELINE_DEPENDENCIES;

export type TimelineKind =
  | "PROJECT_CREATED"
  | "PROJECT_SCHEDULE"
  | "MILESTONE_DATE"
  | "PROGRESS_REPORTED";

export type TimelineKindFilter =
  | "all"
  | "project"
  | "milestone"
  | "progress"
  | TimelineKind;

export type TimelineDateRole =
  | "created"
  | "plannedStart"
  | "plannedEnd"
  | "actualEnd"
  | "plannedMilestoneStart"
  | "plannedMilestoneEnd"
  | "actualMilestoneStart"
  | "actualMilestoneEnd"
  | "reported";

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  eventDate: string;
  precision: "timestamp" | "date";
  category: "planned" | "recorded";
  titleKey:
    | "project.created"
    | "project.plannedStart"
    | "project.plannedEnd"
    | "project.actualEnd"
    | "milestone.plannedStart"
    | "milestone.plannedEnd"
    | "milestone.actualStart"
    | "milestone.actualEnd"
    | "progress.reported";
  sourceId: string;
  sourceKind: "project" | "milestone" | "progressReport";
  dateRole: TimelineDateRole;
  status?: string;
  reportedPercent?: number;
  note?: string;
  label?: string;
};

const KIND_RANK: Record<TimelineKind, number> = {
  PROJECT_CREATED: 0,
  PROJECT_SCHEDULE: 1,
  MILESTONE_DATE: 2,
  PROGRESS_REPORTED: 3,
};

const ROLE_RANK: Record<TimelineDateRole, number> = {
  created: 0,
  plannedStart: 1,
  plannedEnd: 2,
  actualEnd: 3,
  plannedMilestoneStart: 4,
  plannedMilestoneEnd: 5,
  actualMilestoneStart: 6,
  actualMilestoneEnd: 7,
  reported: 8,
};

export function timelineInstant(eventDate: string, precision: "timestamp" | "date"): string | null {
  if (precision === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate);
    const yearText = match?.[1];
    const monthText = match?.[2];
    const dayText = match?.[3];
    if (!yearText || !monthText || !dayText) return null;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
    return parsed.toISOString();
  }
  const parsed = new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function compareTimelineEntries(left: TimelineEntry, right: TimelineEntry): number {
  const leftInstant = timelineInstant(left.eventDate, left.precision) ?? "";
  const rightInstant = timelineInstant(right.eventDate, right.precision) ?? "";
  if (leftInstant !== rightInstant) return leftInstant < rightInstant ? -1 : 1;
  if (KIND_RANK[left.kind] !== KIND_RANK[right.kind]) return KIND_RANK[left.kind] - KIND_RANK[right.kind];
  if (ROLE_RANK[left.dateRole] !== ROLE_RANK[right.dateRole]) return ROLE_RANK[left.dateRole] - ROLE_RANK[right.dateRole];
  if (left.sourceId !== right.sourceId) return left.sourceId < right.sourceId ? -1 : 1;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

export function matchesTimelineKind(entry: TimelineEntry, kind: TimelineKindFilter): boolean {
  if (kind === "all") return true;
  if (kind === "project") return entry.sourceKind === "project";
  if (kind === "milestone") return entry.sourceKind === "milestone";
  if (kind === "progress") return entry.sourceKind === "progressReport";
  return entry.kind === kind;
}

export function pageTimeline(
  entries: readonly TimelineEntry[],
  page: number,
  limit: number,
  sort: "asc" | "desc",
): { entries: TimelineEntry[]; total: number; hasMore: boolean } {
  const ordered = [...entries].sort(compareTimelineEntries);
  if (sort === "desc") ordered.reverse();
  const start = (page - 1) * limit;
  const slice = ordered.slice(start, start + limit);
  return { entries: slice, total: ordered.length, hasMore: start + limit < ordered.length };
}

function dateOnly(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  const iso = value.toISOString().slice(0, 10);
  return timelineInstant(iso, "date") ? iso : null;
}

function timestamp(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

export function projectScheduleEntries(input: {
  id: string;
  createdAt?: Date | null;
  startDate?: Date | null;
  plannedEndDate?: Date | null;
  actualEndDate?: Date | null;
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const created = timestamp(input.createdAt);
  if (created) {
    entries.push({
      id: `project:${input.id}:created`,
      kind: "PROJECT_CREATED",
      eventDate: created,
      precision: "timestamp",
      category: "recorded",
      titleKey: "project.created",
      sourceId: input.id,
      sourceKind: "project",
      dateRole: "created",
    });
  }
  const start = dateOnly(input.startDate);
  if (start) {
    entries.push({
      id: `project:${input.id}:plannedStart`,
      kind: "PROJECT_SCHEDULE",
      eventDate: start,
      precision: "date",
      category: "planned",
      titleKey: "project.plannedStart",
      sourceId: input.id,
      sourceKind: "project",
      dateRole: "plannedStart",
    });
  }
  const plannedEnd = dateOnly(input.plannedEndDate);
  if (plannedEnd) {
    entries.push({
      id: `project:${input.id}:plannedEnd`,
      kind: "PROJECT_SCHEDULE",
      eventDate: plannedEnd,
      precision: "date",
      category: "planned",
      titleKey: "project.plannedEnd",
      sourceId: input.id,
      sourceKind: "project",
      dateRole: "plannedEnd",
    });
  }
  const actualEnd = dateOnly(input.actualEndDate);
  if (actualEnd) {
    entries.push({
      id: `project:${input.id}:actualEnd`,
      kind: "PROJECT_SCHEDULE",
      eventDate: actualEnd,
      precision: "date",
      category: "recorded",
      titleKey: "project.actualEnd",
      sourceId: input.id,
      sourceKind: "project",
      dateRole: "actualEnd",
    });
  }
  return entries;
}

export function milestoneDateEntries(input: {
  id: string;
  title: string;
  status: string;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
}): TimelineEntry[] {
  const label = input.title.trim();
  if (!label) return [];
  const shared = { sourceId: input.id, sourceKind: "milestone" as const, status: input.status, label };
  const plannedStart = dateOnly(input.plannedStart);
  const plannedEnd = dateOnly(input.plannedEnd);
  const actualStart = dateOnly(input.actualStart);
  const actualEnd = dateOnly(input.actualEnd);
  const entries: TimelineEntry[] = [];
  if (plannedStart) {
    entries.push({ ...shared, id: `milestone:${input.id}:plannedStart`, kind: "MILESTONE_DATE", eventDate: plannedStart, precision: "date", category: "planned", titleKey: "milestone.plannedStart", dateRole: "plannedMilestoneStart" });
  }
  if (plannedEnd) {
    entries.push({ ...shared, id: `milestone:${input.id}:plannedEnd`, kind: "MILESTONE_DATE", eventDate: plannedEnd, precision: "date", category: "planned", titleKey: "milestone.plannedEnd", dateRole: "plannedMilestoneEnd" });
  }
  if (actualStart) {
    entries.push({ ...shared, id: `milestone:${input.id}:actualStart`, kind: "MILESTONE_DATE", eventDate: actualStart, precision: "date", category: "recorded", titleKey: "milestone.actualStart", dateRole: "actualMilestoneStart" });
  }
  if (actualEnd) {
    entries.push({ ...shared, id: `milestone:${input.id}:actualEnd`, kind: "MILESTONE_DATE", eventDate: actualEnd, precision: "date", category: "recorded", titleKey: "milestone.actualEnd", dateRole: "actualMilestoneEnd" });
  }
  return entries;
}

export function progressReportEntry(input: {
  id: string;
  reportedAt?: Date | null;
  reportedPercent: number;
  note?: string | null;
}): TimelineEntry | null {
  const eventDate = timestamp(input.reportedAt);
  if (!eventDate || !Number.isInteger(input.reportedPercent) || input.reportedPercent < 0 || input.reportedPercent > 100) return null;
  const note = input.note?.trim();
  return {
    id: `progressReport:${input.id}:reported`,
    kind: "PROGRESS_REPORTED",
    eventDate,
    precision: "timestamp",
    category: "recorded",
    titleKey: "progress.reported",
    sourceId: input.id,
    sourceKind: "progressReport",
    dateRole: "reported",
    reportedPercent: input.reportedPercent,
    ...(note ? { note } : {}),
  };
}
