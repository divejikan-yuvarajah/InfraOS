"use client";

import { CalendarRange, Flag, History } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import {
  BenchmarkStatusBadge,
  ChainageBar,
  CommandHeader,
  DataSourceBadge,
} from "@/components/common/civic-atlas-primitives";
import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ProjectPrerequisites } from "@/components/projects/project-prerequisites";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { fetchProjectTimeline } from "@/lib/projects/timeline-api";
import { getTimelineCopy, timelineTitle } from "@/lib/projects/timeline-messages";
import {
  formatTimelineWhen,
  groupByHeading,
  onTimelineKey,
  plannedRanges,
  timelineHeading,
  timelineQueryKey,
  type TimelineGroup,
  type TimelineViewEntry,
} from "@/lib/projects/timeline-view";
import { ProjectRecordNav, RecordContext } from "./project-record-nav";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function noticeFor(kind: string, copy: ReturnType<typeof getTimelineCopy>): string {
  if (kind === "denied" || kind === "expired") return copy.forbidden;
  if (kind === "notFound") return copy.notFound;
  if (kind === "invalid") return copy.invalid;
  return copy.unavailable;
}

function statusLabel(status: string | undefined, copy: ReturnType<typeof getTimelineCopy>): string {
  if (status === "NOT_STARTED") return copy.plannedStatus;
  return status ?? "";
}

export function ProjectTimelineClient({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const [group, setGroup] = useState<TimelineGroup>("all");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [focus, setFocus] = useState(0);
  const copy = getTimelineCopy(locale);
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no"));
  const timelineQuery = useQuery({
    queryKey: timelineQueryKey(epoch, userId, roleKey, id, group, sort, page),
    enabled: signedIn === "yes" && Boolean(userId),
    retry: false,
    queryFn: () => fetchProjectTimeline(id, group, sort, page),
  });
  const timeline = timelineQuery.data;
  const entries = timeline?.entries ?? [];
  const headings = groupByHeading(entries);
  const ranges = plannedRanges(entries);
  const flatIndex = new Map(entries.map((entry, index) => [entry.id, index]));
  const error = timelineQuery.error ? noticeFor(classifyEditError(timelineQuery.error), copy) : null;
  const showBody = Boolean(timeline) && !error;

  function move(entry: TimelineViewEntry, key: string) {
    const index = flatIndex.get(entry.id) ?? 0;
    const next = onTimelineKey(key, index, entries.length);
    if (next === index) return;
    setFocus(next);
    document.getElementById(entries[next]?.id ?? "")?.focus();
  }

  return (
    <StaffWorkspaceShell
      title={copy.title}
      description={copy.description}
      wide
      context={<RecordContext id={id} locale={locale} current={copy.title} />}
    >
      <ProjectRecordNav id={id} locale={locale} />

      <div className="mt-4 space-y-6">
        {timelineQuery.isLoading ? (
          <ContentSkeleton variant="table" label={copy.loading} />
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
          >
            {error}
          </div>
        ) : null}

        {showBody && timeline ? (
          <>
            {/* Current Status & Chainage Ruler Header */}
            <CommandHeader
              variant="light"
              eyebrow={copy.currentStatus}
              title={copy.title}
              sourceKind="recorded"
              subtitle={
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <BenchmarkStatusBadge status={timeline.current.projectStatus} size="sm" />
                    <span>{copy.currentStatusNote}</span>
                  </div>
                  <p role="note">{copy.provenance}</p>
                  <p role="note" className="font-semibold text-[#9a3412]">
                    {copy.notCompletion}
                  </p>
                  <p role="note" className="font-mono text-[11px] text-slate-500">
                    {timeline.provenance}
                  </p>
                </div>
              }
            >
              <ChainageBar
                verifiedPercent={timeline.current.projectStatus === "COMPLETED" ? 100 : null}
                reportedPercent={timeline.current.physicalProgress}
                label={`${copy.currentProgress} (Reported vs. Verified completion)`}
                verifiedLabel="Verified completion"
                reportedLabel="Reported progress"
              />
            </CommandHeader>

            {/* Prerequisites / Dependencies */}
            {timeline.dependencies.status === "visible" &&
            (timeline.dependencies.links?.length ?? 0) > 0 ? (
              <div className="cac-card p-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {copy.prerequisites}
                </h2>
                <ul aria-label={copy.prerequisites} className="space-y-1.5 text-xs text-slate-700">
                  {timeline.dependencies.links?.map((link) => (
                    <li
                      key={link.id}
                      className="flex items-center gap-2 rounded bg-slate-50 px-3 py-1.5 font-mono"
                    >
                      <span aria-hidden="true" className="text-[#c43d00]">
                        ◆
                      </span>
                      <span>
                        {link.prerequisite.visibility === "visible"
                          ? `${copy.prerequisites}: ${link.prerequisite.projectCode} ${link.prerequisite.title} (${link.prerequisite.projectStatus})`
                          : copy.prereqRestricted}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <ProjectPrerequisites
              projectId={id}
              epoch={epoch}
              userId={userId}
              roleKey={roleKey}
              copy={copy}
              group={group}
              sort={sort}
              page={page}
            />

            {/* Inset Filter & Sort Toolbar + Legend */}
            <div className="cac-inset flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label={copy.filter}
              >
                {(["all", "project", "milestone", "progress"] as const).map((value) => {
                  const active = group === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setGroup(value);
                        setPage(1);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "bg-[#111827] text-white shadow-2xs"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {value === "all"
                        ? copy.all
                        : value === "project"
                          ? copy.schedule
                          : value === "milestone"
                            ? copy.milestones
                            : copy.progress}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={sort === "asc"}
                  onClick={() => {
                    setSort(sort === "asc" ? "desc" : "asc");
                    setPage(1);
                  }}
                  className="ml-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {sort === "asc" ? copy.oldest : copy.newest}
                </button>
              </div>

              <p
                className="flex flex-wrap items-center gap-2 text-xs text-slate-600"
                aria-label={copy.legend}
              >
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 font-semibold text-slate-700">
                  <span aria-hidden="true" className="font-mono text-[10px]">
                    ○
                  </span>
                  {copy.planned}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2.5 py-0.5 font-semibold text-[#9a3412]">
                  <span aria-hidden="true" className="font-mono text-[10px]">
                    ●
                  </span>
                  {copy.recorded}
                </span>
                <span className="text-[11px] text-slate-500">{copy.dateOnly}</span>
                <span className="text-[11px] text-slate-500">· {copy.timestamp}</span>
              </p>
            </div>

            {timeline.sourceAvailability.milestone === "restricted" ? (
              <p
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
              >
                {copy.milestoneRestricted}
              </p>
            ) : null}
            {timeline.sourceAvailability.progress === "restricted" ? (
              <p
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900"
              >
                {copy.progressRestricted}
              </p>
            ) : null}
            {timeline.sourceAvailability.milestone === "unavailable" ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900"
              >
                {copy.milestoneUnavailable}
              </p>
            ) : null}
            {timeline.sourceAvailability.progress === "unavailable" ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900"
              >
                {copy.progressUnavailable}
              </p>
            ) : null}
            {timeline.historyCapped ? (
              <p
                role="status"
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600"
              >
                {copy.capped}
              </p>
            ) : null}

            {timeline.sourceAvailability.milestone === "visible" &&
            !entries.some((entry) => entry.sourceKind === "milestone") &&
            group !== "progress" &&
            group !== "project" ? (
              <p className="text-xs text-slate-600">{copy.noMilestones}</p>
            ) : null}
            {timeline.sourceAvailability.progress === "visible" &&
            !entries.some((entry) => entry.sourceKind === "progressReport") &&
            group !== "milestone" &&
            group !== "project" ? (
              <p className="text-xs text-slate-600">{copy.noProgress}</p>
            ) : null}

            {/* Horizontal Planned Schedule Ranges */}
            {ranges.length > 0 ? (
              <section
                className="cac-card p-5 space-y-3"
                aria-labelledby="timeline-ranges"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 id="timeline-ranges" className="text-base font-semibold text-slate-900">
                      {copy.ranges}
                    </h2>
                    <p className="text-xs text-slate-500">{copy.rangeNote}</p>
                  </div>
                  <DataSourceBadge kind="recorded" />
                </div>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ranges.map((range, rIdx) => (
                    <li
                      key={range.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-500">
                          SCH-{String(rIdx + 1).padStart(2, "0")}
                        </span>
                        <BenchmarkStatusBadge
                          status={range.status ?? "PLANNED"}
                          label={`${copy.statusNow}: ${statusLabel(range.status, copy)}`}
                          size="sm"
                        />
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{range.label}</div>
                      <div className="font-mono text-xs text-slate-600 tabular-nums">
                        {formatTimelineWhen(range.start, "date", locale)} –{" "}
                        {formatTimelineWhen(range.end, "date", locale)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {entries.length === 0 ? (
              <EmptyState variant="empty" title={copy.empty} />
            ) : null}

            {/* Vertical Alignment Chronology */}
            <ol
              className="space-y-6"
              aria-label={copy.title}
            >
              {headings.map((heading) => (
                <li key={heading.heading} className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#ff5b00]" />
                    <h2 className="font-mono text-xs font-bold text-slate-800">
                      {formatTimelineWhen(heading.heading, "date", locale)}
                    </h2>
                  </div>

                  <ol className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-3.5 before:w-0.5 before:bg-slate-200">
                    {heading.entries.map((entry) => {
                      const index = flatIndex.get(entry.id) ?? 0;
                      const Icon =
                        entry.sourceKind === "progressReport"
                          ? History
                          : entry.sourceKind === "milestone"
                            ? Flag
                            : CalendarRange;
                      const isRecorded = entry.category === "recorded";

                      return (
                        <li key={entry.id} className="relative pl-10">
                          <span
                            aria-hidden="true"
                            className={`absolute top-4 left-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-xs font-bold ${
                              isRecorded
                                ? "border-[#ff5b00] bg-[#fff7ed] text-[#c43d00]"
                                : "border-slate-300 bg-white text-slate-500"
                            }`}
                          >
                            {isRecorded ? "●" : "○"}
                          </span>

                          <article
                            id={entry.id}
                            className="cac-card p-4 space-y-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b00]"
                            tabIndex={index === focus ? 0 : -1}
                            onKeyDown={(event) => {
                              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                                event.preventDefault();
                                move(entry, event.key);
                              }
                            }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-900">
                                    {timelineTitle(copy, entry.titleKey)}
                                  </h3>
                                  {entry.label ? (
                                    <p className="text-xs font-medium text-slate-700">
                                      {entry.label}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                    isRecorded
                                      ? "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]"
                                      : "border-slate-200 bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  {entry.category === "planned" ? copy.planned : copy.recorded}
                                </span>
                                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                                  {entry.precision === "date" ? copy.dateOnly : copy.timestamp}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                {formatTimelineWhen(entry.eventDate, entry.precision, locale)}
                              </span>
                              {entry.status ? (
                                <BenchmarkStatusBadge
                                  status={entry.status}
                                  label={`${copy.statusNow}: ${statusLabel(entry.status, copy)}`}
                                  size="sm"
                                />
                              ) : null}
                              <span className="font-mono text-[11px] text-slate-400">
                                {timelineHeading(entry.eventDate, entry.precision)}
                              </span>
                            </div>

                            {typeof entry.reportedPercent === "number" ? (
                              <div className="pt-1">
                                <ChainageBar
                                  verifiedPercent={null}
                                  reportedPercent={entry.reportedPercent}
                                  label={`${copy.reported}: ${entry.reportedPercent}%`}
                                  showRulerLabels={false}
                                />
                              </div>
                            ) : null}

                            {entry.note ? (
                              <p className="rounded-md bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100">
                                {entry.note}
                              </p>
                            ) : null}
                          </article>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ol>

            {/* Pagination */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
              <span className="font-mono text-xs text-slate-500">Page {page}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  {copy.previous}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  disabled={!timeline.hasMore}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {copy.next}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {signedIn === "no" ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
          >
            {copy.forbidden}
          </div>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}
