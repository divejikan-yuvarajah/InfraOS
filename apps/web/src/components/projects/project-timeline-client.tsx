"use client";

import { CalendarRange, Flag, History } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { ProjectPrerequisites } from "@/components/projects/project-prerequisites";
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
  const [locale, setLocale] = useState<AuthLocale>("en");
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
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <div role="group" aria-label={copy.language}>
        <button type="button" className="auth-access-button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>{copy.english}</button>
        <button type="button" className="auth-access-button" aria-pressed={locale === "si"} onClick={() => setLocale("si")}>{copy.sinhala}</button>
        <button type="button" className="auth-access-button" aria-pressed={locale === "ta"} onClick={() => setLocale("ta")}>{copy.tamil}</button>
      </div>
      <p role="note">{copy.nativeReview}</p>
      <p><Link className="auth-access-button" href={`/projects/${id}/overview`}>{copy.back}</Link></p>
      {timelineQuery.isLoading ? <p role="status">{copy.loading}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {showBody && timeline ? (
        <>
          <p role="note">{copy.provenance}</p>
          <p role="note">{copy.notCompletion}</p>
          <p role="note">{timeline.provenance}</p>
          {timeline.dependencies.status === "visible" && (timeline.dependencies.links?.length ?? 0) > 0 ? (
            <ul aria-label={copy.prerequisites}>
              {timeline.dependencies.links?.map((link) => (
                <li key={link.id}>
                  {link.prerequisite.visibility === "visible"
                    ? `${copy.prerequisites}: ${link.prerequisite.projectCode} ${link.prerequisite.title} (${link.prerequisite.projectStatus})`
                    : copy.prereqRestricted}
                </li>
              ))}
            </ul>
          ) : null}
          <ProjectPrerequisites projectId={id} epoch={epoch} userId={userId} roleKey={roleKey} copy={copy} group={group} sort={sort} page={page} />
          <section className="auth-access-card" aria-labelledby="timeline-current">
            <h2 id="timeline-current">{copy.currentStatus}</h2>
            <p>{copy.currentStatusNote}</p>
            <p>{timeline.current.projectStatus}</p>
            <p>{copy.currentProgress}: {timeline.current.physicalProgress}%</p>
          </section>
          <div className="project-timeline-toolbar" role="group" aria-label={copy.filter}>
            {(["all", "project", "milestone", "progress"] as const).map((value) => (
              <button key={value} type="button" className="auth-access-button" aria-pressed={group === value} onClick={() => { setGroup(value); setPage(1); }}>
                {value === "all" ? copy.all : value === "project" ? copy.schedule : value === "milestone" ? copy.milestones : copy.progress}
              </button>
            ))}
            <button type="button" className="auth-access-button" aria-pressed={sort === "asc"} onClick={() => { setSort(sort === "asc" ? "desc" : "asc"); setPage(1); }}>
              {sort === "asc" ? copy.oldest : copy.newest}
            </button>
          </div>
          <p className="project-timeline-legend" aria-label={copy.legend}>
            <span className="project-timeline-chip planned">{copy.planned}</span>
            <span className="project-timeline-chip recorded">{copy.recorded}</span>
            <span>{copy.dateOnly}</span>
            <span>{copy.timestamp}</span>
          </p>
          {timeline.sourceAvailability.milestone === "restricted" ? <p role="status">{copy.milestoneRestricted}</p> : null}
          {timeline.sourceAvailability.progress === "restricted" ? <p role="status">{copy.progressRestricted}</p> : null}
          {timeline.sourceAvailability.milestone === "unavailable" ? <p role="alert">{copy.milestoneUnavailable}</p> : null}
          {timeline.sourceAvailability.progress === "unavailable" ? <p role="alert">{copy.progressUnavailable}</p> : null}
          {timeline.historyCapped ? <p role="status">{copy.capped}</p> : null}
          {timeline.sourceAvailability.milestone === "visible" && !entries.some((entry) => entry.sourceKind === "milestone") && group !== "progress" && group !== "project" ? <p>{copy.noMilestones}</p> : null}
          {timeline.sourceAvailability.progress === "visible" && !entries.some((entry) => entry.sourceKind === "progressReport") && group !== "milestone" && group !== "project" ? <p>{copy.noProgress}</p> : null}
          {ranges.length > 0 ? (
            <section className="auth-access-card project-timeline-ranges" aria-labelledby="timeline-ranges">
              <h2 id="timeline-ranges">{copy.ranges}</h2>
              <p>{copy.rangeNote}</p>
              <ul>
                {ranges.map((range) => (
                  <li key={range.id}>
                    <span>{range.label}</span>
                    <span>{formatTimelineWhen(range.start, "date", locale)} – {formatTimelineWhen(range.end, "date", locale)}</span>
                    <span>{copy.statusNow}: {statusLabel(range.status, copy)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {entries.length === 0 ? <p role="status">{copy.empty}</p> : null}
          <ol className="project-timeline-rail" aria-label={copy.title}>
            {headings.map((heading) => (
              <li key={heading.heading}>
                <h2>{formatTimelineWhen(heading.heading, "date", locale)}</h2>
                <ol>
                  {heading.entries.map((entry) => {
                    const index = flatIndex.get(entry.id) ?? 0;
                    const Icon = entry.sourceKind === "progressReport" ? History : entry.sourceKind === "milestone" ? Flag : CalendarRange;
                    return (
                      <li key={entry.id}>
                        <article
                          id={entry.id}
                          className="auth-access-card project-timeline-card"
                          tabIndex={index === focus ? 0 : -1}
                          onKeyDown={(event) => {
                            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                              event.preventDefault();
                              move(entry, event.key);
                            }
                          }}
                        >
                          <Icon aria-hidden="true" />
                          <h3>{timelineTitle(copy, entry.titleKey)}</h3>
                          {entry.label ? <p>{entry.label}</p> : null}
                          <p>{formatTimelineWhen(entry.eventDate, entry.precision, locale)}</p>
                          <p>
                            <span className={`project-timeline-chip ${entry.category}`}>{entry.category === "planned" ? copy.planned : copy.recorded}</span>
                            <span>{entry.precision === "date" ? copy.dateOnly : copy.timestamp}</span>
                          </p>
                          {entry.status ? <p>{copy.statusNow}: {statusLabel(entry.status, copy)}</p> : null}
                          {typeof entry.reportedPercent === "number" ? <p>{copy.reported}: {entry.reportedPercent}%</p> : null}
                          {entry.note ? <p>{entry.note}</p> : null}
                          <p className="project-timeline-day">{timelineHeading(entry.eventDate, entry.precision)}</p>
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
          <div className="auth-access-locale-row">
            <button type="button" className="auth-access-button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{copy.previous}</button>
            <button type="button" className="auth-access-button" disabled={!timeline.hasMore} onClick={() => setPage((current) => current + 1)}>{copy.next}</button>
          </div>
        </>
      ) : null}
      {signedIn === "no" ? <p role="alert">{copy.forbidden}</p> : null}
    </StaffWorkspaceShell>
  );
}
