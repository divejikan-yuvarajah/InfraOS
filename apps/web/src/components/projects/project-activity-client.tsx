"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProjectActivity } from "@/lib/projects/activity-api";
import { activityTitle, getActivityCopy } from "@/lib/projects/activity-messages";
import { activityPageState, activityPagesForScope, activityQueryKey, activityScope, formatActivityWhen, rememberActivityPage, visibleActivityItems, type ActivityFilter, type ActivityPageState, type ActivityViewItem } from "@/lib/projects/activity-view";
import { classifyEditError } from "@/lib/projects/edit-outcome";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function noticeFor(kind: string, copy: ReturnType<typeof getActivityCopy>): string {
  if (kind === "denied" || kind === "expired") return copy.forbidden;
  if (kind === "notFound") return copy.notFound;
  if (kind === "invalid") return copy.invalid;
  return copy.unavailable;
}

function detailText(item: ActivityViewItem, copy: ReturnType<typeof getActivityCopy>): string | null {
  const detail = item.detail;
  if (!detail) return null;
  if (typeof detail.reportedPercent === "number") return `${copy.reported}: ${detail.reportedPercent}%`;
  if (typeof detail.milestoneTitle === "string") {
    const status = typeof detail.milestoneStatus === "string" ? ` · ${copy.milestoneStatus}: ${detail.milestoneStatus}` : "";
    return `${detail.milestoneTitle}${status}`;
  }
  if (detail.prerequisiteVisibility === "visible" && typeof detail.projectCode === "string") {
    return `${copy.prerequisite}: ${detail.projectCode} ${typeof detail.title === "string" ? detail.title : ""}`;
  }
  if (detail.prerequisiteVisibility === "restricted") return copy.restricted;
  if (typeof detail.status === "string") return detail.status;
  return null;
}

export function ProjectActivityClient({ id }: { id: string }) {
  const [locale, setLocale] = useState<AuthLocale>("en");
  const [category, setCategory] = useState<ActivityFilter>("all");
  const copy = getActivityCopy(locale);
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no"));
  const scope = activityScope(epoch, userId, roleKey, id);
  const [pageState, setPageState] = useState<ActivityPageState>(() => activityPageState(scope));
  if (pageState.scope !== scope) setPageState(activityPageState(scope));
  const pages = activityPagesForScope(pageState, scope);
  const activityQuery = useQuery({
    queryKey: activityQueryKey(epoch, userId, roleKey, id, category, pages.cursor ?? ""),
    enabled: signedIn === "yes" && Boolean(userId),
    retry: false,
    queryFn: () => fetchProjectActivity(id, category, pages.cursor),
  });
  const error = activityQuery.error ? noticeFor(classifyEditError(activityQuery.error), copy) : null;
  const current = activityQuery.data?.projectId === id ? activityQuery.data.activities : [];
  const items = visibleActivityItems(pages, scope, signedIn === "yes", current);

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <div role="group" aria-label={copy.language}>
        <button type="button" className="auth-access-button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>{copy.english}</button>
        <button type="button" className="auth-access-button" aria-pressed={locale === "si"} onClick={() => setLocale("si")}>{copy.sinhala}</button>
        <button type="button" className="auth-access-button" aria-pressed={locale === "ta"} onClick={() => setLocale("ta")}>{copy.tamil}</button>
      </div>
      <p role="note">{copy.nativeReview}</p>
      <p><Link className="auth-access-button" href={`/projects/${id}/overview`}>{copy.back}</Link></p>
      <p><Link className="auth-access-button" href={`/projects/${id}/timeline`}>{copy.timeline}</Link></p>
      {activityQuery.isLoading ? <p role="status">{copy.loading}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {signedIn === "yes" && activityQuery.data?.projectId === id && !error ? (
        <>
          <p role="note">{copy.provenance}</p>
          <p role="note">{copy.notCompletion}</p>
          <p role="note">{copy.notBank}</p>
          <p role="note">{copy.informational}</p>
          <p>{activityQuery.data.projectStatus}</p>
          <p>{copy.reported}: {activityQuery.data.physicalProgress}%</p>
          {activityQuery.data.coverage === "partial_source_coverage" ? <p role="status">{copy.partial}</p> : null}
          <div className="project-activity-toolbar" role="group" aria-label={copy.filter}>
            {(["all", "project", "milestone", "progress", "dependency"] as const).map((value) => (
              <button key={value} type="button" className="auth-access-button" aria-pressed={category === value} onClick={() => { setCategory(value); setPageState(activityPageState(scope)); }}>
                {copy[value]}
              </button>
            ))}
          </div>
          {items.length === 0 ? <p role="status">{copy.empty}</p> : null}
          <ol className="project-activity-list" aria-label={copy.title}>
            {items.map((item) => (
              <li key={item.id}>
                <article className="auth-access-card project-activity-card">
                  <h2>{activityTitle(copy, item.titleKey)}</h2>
                  <p>{item.actor.label === "System event" ? copy.actorSystem : copy.actorStaff}</p>
                  <p>{item.source === "audit" ? copy.sourceAudit : item.source === "recorded_report" ? copy.sourceReport : copy.sourceMetadata}</p>
                  <time dateTime={item.occurredAt}>{formatActivityWhen(item.occurredAt, locale)}</time>
                  {detailText(item, copy) ? <p>{detailText(item, copy)}</p> : null}
                </article>
              </li>
            ))}
          </ol>
          {activityQuery.data.hasMore && activityQuery.data.nextCursor ? (
            <button
              type="button"
              className="auth-access-button"
              onClick={() => {
                setPageState((state) => rememberActivityPage(activityPagesForScope(state, scope), scope, items, activityQuery.data?.nextCursor ?? null));
              }}
            >
              {copy.loadMore}
            </button>
          ) : null}
        </>
      ) : null}
      {signedIn === "no" ? <p role="alert">{copy.forbidden}</p> : null}
    </StaffWorkspaceShell>
  );
}
