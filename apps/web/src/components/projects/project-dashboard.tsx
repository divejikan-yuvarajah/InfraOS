"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProjectDashboard } from "@/lib/projects/dashboard-api";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import {
  canLinkProjectRecord,
  dashboardCards,
  dashboardIsEmpty,
  dashboardIsPartial,
  dashboardQueryKey,
  dashboardScope,
  statusRows,
  visibleDashboard,
} from "@/lib/projects/dashboard-view";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { formatActivityWhen } from "@/lib/projects/activity-view";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function money(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = String(Math.abs(minor % 100)).padStart(2, "0");
  return `LKR ${whole}.${cents}`;
}

export function ProjectDashboard({ locale, onLocale }: { locale: AuthLocale; onLocale: (locale: AuthLocale) => void }) {
  const copy = getDashboardCopy(locale);
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no")) === "yes";
  const scope = dashboardScope(epoch, userId, roleKey);
  const query = useQuery({
    queryKey: dashboardQueryKey(epoch, userId, roleKey),
    enabled: signedIn,
    queryFn: () => fetchProjectDashboard(),
  });
  const data = visibleDashboard(query.data, dashboardScope(epoch, userId, roleKey), scope, signedIn);
  const failure = query.error ? classifyEditError(query.error) : null;
  const notice = !signedIn
    ? null
    : failure === "denied"
      ? copy.forbidden
      : failure === "expired" || failure === "stale"
        ? copy.expired
        : failure
          ? copy.unavailable
          : null;

  return (
    <section className="project-dashboard" aria-label={copy.title}>
      <div className="project-dashboard-toolbar">
        <p className="auth-access-status" role="status">{copy.nativeReview}</p>
        <div className="project-dashboard-languages" role="group" aria-label={copy.language}>
          {(["en", "si", "ta"] as const).map((item) => (
            <button key={item} type="button" className={locale === item ? "auth-access-button is-current" : "auth-access-button"} aria-pressed={locale === item} onClick={() => onLocale(item)}>
              {item === "en" ? copy.english : item === "si" ? copy.sinhala : copy.tamil}
            </button>
          ))}
        </div>
      </div>
      {query.isPending && signedIn ? <p role="status">{copy.loading}</p> : null}
      {notice ? (
        <div className="auth-access-banner error" role="alert">
          <p>{notice}</p>
          {failure !== "denied" && failure !== "expired" ? (
            <button type="button" className="auth-access-button" onClick={() => void query.refetch()}>{copy.retry}</button>
          ) : null}
        </div>
      ) : null}
      {data ? (
        <>
          <p className="project-dashboard-provenance">
            {data.scope === "platform" ? copy.scopePlatform : data.scope === "assigned" ? copy.scopeAssigned : copy.scopeAgency}
            {" · "}
            {copy.asOf} {formatActivityWhen(data.asOf, locale)}
          </p>
          {dashboardIsEmpty(data) ? <p role="status">{copy.empty}</p> : null}
          {dashboardIsPartial(data) ? <p role="status">{copy.milestonesUnavailable}</p> : null}
          <ul className="project-dashboard-kpis">
            {dashboardCards(data).map((card) => (
              <li key={card.id} className={`project-dashboard-kpi is-${card.tone}`}>
                <p className="project-dashboard-kpi-label">
                  {card.id === "total" ? copy.total : card.id === "active" ? copy.active : card.id === "onHold" ? copy.onHold : card.id === "delayed" ? copy.delayed : card.id === "reportedOpen" ? copy.reportedOpen : copy.reviews}
                </p>
                <p className="project-dashboard-kpi-value">{card.value === null ? "—" : card.value}</p>
              </li>
            ))}
          </ul>
          <p className="project-dashboard-note">{copy.physicalMeaning} {copy.completedByStatus}: {data.physical.completedByStatus}.</p>
          <div className="project-dashboard-split">
            <div>
              <h2 id="project-dashboard-status">{copy.statusChart}</h2>
              <div className="project-dashboard-bars" role="img" aria-labelledby="project-dashboard-status project-dashboard-table">
                {statusRows(data).map((row) => (
                  <div key={row.status} className="project-dashboard-bar-row">
                    <span>{row.status}</span>
                    <span className={`project-dashboard-bar is-${row.status.toLowerCase()}`} style={{ width: `${row.width}%` }} />
                    <span>{row.count}</span>
                  </div>
                ))}
              </div>
              <table className="project-dashboard-table" id="project-dashboard-table">
                <caption>{copy.statusTable}</caption>
                <thead>
                  <tr>
                    <th scope="col">{copy.statusTable}</th>
                    <th scope="col">{copy.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows(data).map((row) => (
                    <tr key={row.status}>
                      <th scope="row">{row.status}</th>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2>{copy.recent}</h2>
              {data.recentProjects.length === 0 ? <p>{copy.empty}</p> : (
                <ul className="project-dashboard-list">
                  {data.recentProjects.map((project) => (
                    <li key={project.id}>
                      <Link href={`/projects/${project.id}`}>{project.projectCode}</Link>
                      <span>{project.title}</span>
                      <span>{project.status}</span>
                      <time dateTime={project.updatedAt}>{formatActivityWhen(project.updatedAt, locale)}</time>
                      {canLinkProjectRecord(roleKey) ? (
                        <>
                          <Link href={`/projects/${project.id}/timeline`}>{copy.timeline}</Link>
                          <Link href={`/projects/${project.id}/activity`}>{copy.activity}</Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <section aria-labelledby="project-dashboard-milestones">
            <h2 id="project-dashboard-milestones">{copy.milestones}</h2>
            {data.milestones ? (
              <>
                <p>{copy.overdue}: {data.milestones.overdue}. {copy.due}: {data.milestones.dueWithin14Days}.</p>
                <p>{copy.plannedMeaning}</p>
                <ul className="project-dashboard-list">
                  {data.milestones.items.map((item) => (
                    <li key={item.id}>
                      <Link href={`/projects/${item.projectId}`}>{item.projectCode}</Link>
                      <span>{item.title}</span>
                      <span>{item.classification}</span>
                      <span>{item.status}</span>
                      <time dateTime={item.plannedEnd}>{formatActivityWhen(item.plannedEnd, locale)}</time>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p>{copy.milestonesUnavailable}</p>}
          </section>
          <section aria-labelledby="project-dashboard-reviews">
            <h2 id="project-dashboard-reviews">{copy.reviews}</h2>
            {data.reviews ? (
              <>
                <p>{data.reviews.pending}</p>
                <ul className="project-dashboard-list">
                  {data.reviews.items.map((item) => (
                    <li key={item.id}>
                      <Link href={`/projects/${item.id}/review`}>{item.projectCode}</Link>
                      <span>{item.title}</span>
                      <span>{item.status}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/projects/reviews">{copy.reviewQueue}</Link>
              </>
            ) : <p>{copy.reviewsUnavailable}</p>}
          </section>
          <section aria-labelledby="project-dashboard-finance">
            <h2 id="project-dashboard-finance">{copy.finance}</h2>
            {data.finance ? (
              <>
                <p>{data.finance.storedPaidCount} · {money(data.finance.storedPaidAmountMinor)}</p>
                <p>{copy.financeMeaning}</p>
              </>
            ) : <p>{data.coverage.finance === "unavailable" ? copy.financeSourceDown : copy.financeUnavailable}</p>}
          </section>
          {typeof data.assignedToYou === "number" ? <p>{copy.assigned}: {data.assignedToYou}</p> : null}
          <p><Link href="/projects">{copy.projects}</Link></p>
        </>
      ) : null}
    </section>
  );
}
