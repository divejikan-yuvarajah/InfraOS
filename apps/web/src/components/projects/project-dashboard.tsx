"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, ArrowRightIcon, CheckIcon, ClipboardCheckIcon, ClockIcon, MegaphoneIcon, RefreshCwIcon } from "lucide-react";

import { MotifIllustration } from "@/components/motif/connected-motif";
import { ContextBar, HonestyChip, StatusChip, StatusNode } from "@/components/site-plan/site-plan";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { coverageHonesty } from "@/lib/design/site-plan";
import { fetchProjectDashboard } from "@/lib/projects/dashboard-api";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import {
  attentionItems,
  canLinkProjectRecord,
  dashboardIsEmpty,
  dashboardQueryKey,
  dashboardScope,
  dashboardStatusLabel,
  portfolioLine,
  statusRows,
  visibleDashboard,
  type AttentionItem,
} from "@/lib/projects/dashboard-view";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { formatActivityWhen } from "@/lib/projects/activity-view";

import "@/styles/site-plan-dashboard.css";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function money(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = String(Math.abs(minor % 100)).padStart(2, "0");
  return `LKR ${new Intl.NumberFormat("en-LK").format(whole)}.${cents}`;
}

/** Phase 6 headings with no SI/TA source yet: English fallback, listed in docs/design/i18n-missing.md. */
const NEW_COPY = {
  lifecycle: "Portfolio lifecycle",
  lifecycleHint: "Projects at each stage. Branches show projects off the main path.",
  honesty: "Progress and money",
  completed: "Completed by status",
  reportedOpen: "Reported 100%, not completed",
  workspace: "Workspace",
  dashboard: "Dashboard",
} as const;

const ATTENTION_ICON: Record<AttentionItem["id"], typeof ClockIcon> = {
  delayed: AlertTriangleIcon,
  overdue: ClockIcon,
  reviews: ClipboardCheckIcon,
  reportedOpen: MegaphoneIcon,
};

export function ProjectDashboard({ locale }: { locale: AuthLocale }) {
  const copy = getDashboardCopy(locale);
  const label = (status: string) => dashboardStatusLabel(status, copy);
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

  const attentionText = (item: AttentionItem) =>
    item.id === "delayed" ? copy.delayed : item.id === "reviews" ? copy.reviews : item.id === "overdue" ? copy.overdue : copy.reportedOpen;
  const scopeLabel = data ? (data.scope === "platform" ? copy.scopePlatform : data.scope === "assigned" ? copy.scopeAssigned : copy.scopeAgency) : null;
  const attention = data ? attentionItems(data) : [];
  const empty = data ? dashboardIsEmpty(data) : false;
  const line = data ? portfolioLine(data) : null;
  const financeHonesty = data ? coverageHonesty(data.coverage.finance) : null;

  return (
    <section className="spd" aria-label={copy.title}>
      <ContextBar
        crumbs={[{ label: NEW_COPY.workspace }, { label: NEW_COPY.dashboard }]}
        scope={scopeLabel}
        asOf={data ? formatActivityWhen(data.asOf, locale) : null}
      />
      {locale !== "en" ? <p className="spd-note">{copy.nativeReview}</p> : null}

      {query.isPending && signedIn ? (
        <div className="spd-grid" role="status" aria-label={copy.loading}>
          <span className="mc-skel spd-skel-wide" />
          <span className="mc-skel" />
          <span className="mc-skel spd-skel-full" />
        </div>
      ) : null}

      {notice ? (
        <div className="mc-alert is-critical" role="alert">
          <AlertTriangleIcon aria-hidden="true" />
          <p>{notice}</p>
          {failure !== "denied" && failure !== "expired" ? (
            <button type="button" className="mc-btn" onClick={() => void query.refetch()}>
              <RefreshCwIcon aria-hidden="true" style={{ width: "1rem", height: "1rem", display: "inline", marginRight: "0.35rem" }} />
              {copy.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      {data && line ? (
        <>
          <div className="spd-grid">
            {/* 1 · Action before history */}
            <section className="sp-surface spd-attention" aria-labelledby="spd-attention-h">
              <header className="spd-head">
                <h2 id="spd-attention-h">{copy.attention}</h2>
                {attention.length > 0 ? <span className="spd-count">{attention.reduce((n, i) => n + i.count, 0)}</span> : null}
              </header>
              {attention.length === 0 ? (
                <div className="spd-calm">
                  <MotifIllustration kind={empty ? "no-projects" : "all-clear"} className="spd-illustration" />
                  <p role="status">{empty ? copy.empty : copy.attentionClear}</p>
                  {empty ? (
                    <Link href="/projects" className="mc-link">
                      {copy.projects} →
                    </Link>
                  ) : null}
                </div>
              ) : (
                <ul className="spd-lane">
                  {attention.map((item) => {
                    const Icon = ATTENTION_ICON[item.id];
                    const critical = item.id === "delayed" || item.id === "overdue";
                    const body = (
                      <>
                        <span className="spd-lane-icon" aria-hidden="true">
                          <Icon />
                        </span>
                        <span className="spd-lane-text">{attentionText(item)}</span>
                        {item.id === "reportedOpen" ? <HonestyChip kind="reported" /> : null}
                        <span className="spd-lane-count sp-num">{item.count}</span>
                        {item.href ? <ArrowRightIcon className="spd-lane-go" aria-hidden="true" /> : null}
                      </>
                    );
                    return (
                      <li key={item.id} data-weight={critical ? "critical" : "pending"}>
                        {item.href ? (
                          <Link href={item.href} className="spd-lane-row">
                            {body}
                            <span className="mc-sr"> — {copy.viewList}</span>
                          </Link>
                        ) : (
                          <div className="spd-lane-row">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 2 · Progress honesty: reported ≠ completed, money is provisional */}
            <section className="sp-surface spd-honesty" aria-labelledby="spd-honesty-h">
              <header className="spd-head">
                <h2 id="spd-honesty-h">{NEW_COPY.honesty}</h2>
              </header>
              <dl className="spd-pair">
                <div data-kind="completed">
                  <dt>
                    <span className="spd-pair-mark" aria-hidden="true">
                      <CheckIcon />
                    </span>
                    {NEW_COPY.completed}
                  </dt>
                  <dd className="sp-num">{data.physical.completedByStatus}</dd>
                </div>
                <div data-kind="reported">
                  <dt>
                    <span className="spd-pair-mark" aria-hidden="true" />
                    {NEW_COPY.reportedOpen}
                    <HonestyChip kind="reported" />
                  </dt>
                  <dd className="sp-num">{data.physical.reportedAt100StillNotCompleted}</dd>
                </div>
              </dl>
              <p className="spd-small">{copy.physicalMeaning}</p>
              <div className="spd-money">
                <p className="spd-money-label">
                  {copy.finance} <HonestyChip kind="provisional" />
                </p>
                {data.finance ? (
                  <>
                    <p className="spd-money-value sp-num">{money(data.finance.storedPaidAmountMinor)}</p>
                    <p className="spd-small">
                      {data.finance.storedPaidCount} · {copy.financeMeaning}
                    </p>
                  </>
                ) : (
                  <p className="spd-small">
                    {financeHonesty ? <HonestyChip kind={financeHonesty} /> : null}{" "}
                    {data.coverage.finance === "unavailable" ? copy.financeSourceDown : copy.financeUnavailable}
                  </p>
                )}
              </div>
            </section>

            {/* 3 · Portfolio lifecycle line (replaces equal KPI cards + donut) */}
            <section className="sp-surface spd-line" aria-labelledby="spd-line-h">
              <header className="spd-head">
                <h2 id="spd-line-h">{NEW_COPY.lifecycle}</h2>
                <span className="spd-total">
                  {copy.total}: <strong className="sp-num">{line.total}</strong>
                </span>
              </header>
              <p className="spd-small">{NEW_COPY.lifecycleHint}</p>
              <ol className="spd-route" aria-label={NEW_COPY.lifecycle}>
                {line.main.map((n) => (
                  <li key={n.status} data-empty={n.count === 0 ? "true" : undefined}>
                    <Link href={n.href} className="spd-stop">
                      <span className="spd-stop-node">
                        <StatusNode domain="project" status={n.status} />
                      </span>
                      <span className="spd-stop-count sp-num">{n.count}</span>
                      <span className="spd-stop-label">{label(n.status)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              {line.branches.length > 0 ? (
                <ul className="spd-branches" aria-label="Off the main path">
                  {line.branches.map((b) => (
                    <li key={b.status}>
                      <Link href={b.href} className="spd-branch">
                        <StatusChip domain="project" status={b.status} label={label(b.status)} />
                        <span className="sp-num">{b.count}</span>
                        {b.from ? <span className="spd-from">from {label(b.from)}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <details className="mc-details">
                <summary>{copy.statusTable}</summary>
                <table className="mc-table-mini">
                  <caption className="mc-sr">{copy.statusTable}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{copy.statusChart}</th>
                      <th scope="col" className="mc-num">
                        {copy.total}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusRows(data).map((row) => (
                      <tr key={row.status}>
                        <th scope="row">{label(row.status)}</th>
                        <td className="mc-num">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>

            {/* 4 · Planned milestone dates */}
            <section className="sp-surface spd-milestones" aria-labelledby="spd-ms-h">
              <header className="spd-head">
                <h2 id="spd-ms-h">{copy.milestones}</h2>
              </header>
              {data.milestones ? (
                <>
                  <dl className="spd-kv">
                    <div data-weight="critical">
                      <dt>{copy.overdue}</dt>
                      <dd className="sp-num">{data.milestones.overdue}</dd>
                    </div>
                    <div data-weight="pending">
                      <dt>{copy.due}</dt>
                      <dd className="sp-num">{data.milestones.dueWithin14Days}</dd>
                    </div>
                  </dl>
                  {data.milestones.items.length > 0 ? (
                    <ul className="spd-rows">
                      {data.milestones.items.map((item) => (
                        <li key={item.id} data-weight={item.classification === "overdue" ? "critical" : "pending"}>
                          <Link href={`/projects/${item.projectId}`} className="spd-code">
                            {item.projectCode}
                          </Link>
                          <span className="spd-row-title">{item.title}</span>
                          <time dateTime={item.plannedEnd} className="spd-when">
                            {formatActivityWhen(item.plannedEnd, locale)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="spd-small">{copy.plannedMeaning}</p>
                </>
              ) : (
                <p className="spd-small">
                  <HonestyChip kind="unavailable" /> {copy.milestonesUnavailable}
                </p>
              )}
            </section>

            {/* 5 · Reviews (role-dependent: only when the API includes them) */}
            {data.reviews ? (
              <section className="sp-surface spd-reviews" aria-labelledby="spd-rev-h">
                <header className="spd-head">
                  <h2 id="spd-rev-h">{copy.reviews}</h2>
                  <span className="spd-count">{data.reviews.pending}</span>
                </header>
                {data.reviews.items.length > 0 ? (
                  <ul className="spd-rows">
                    {data.reviews.items.map((item) => (
                      <li key={item.id}>
                        <Link href={`/projects/${item.id}/review`} className="spd-code">
                          {item.projectCode}
                        </Link>
                        <span className="spd-row-title">{item.title}</span>
                        <StatusChip domain="project" status={item.status} label={label(item.status)} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link href="/projects/reviews" className="mc-link">
                  {copy.reviewQueue} →
                </Link>
              </section>
            ) : null}

            {/* 6 · Recent projects (history last) */}
            <section className="sp-surface spd-recent" aria-labelledby="spd-recent-h">
              <header className="spd-head">
                <h2 id="spd-recent-h">{copy.recent}</h2>
                {typeof data.assignedToYou === "number" ? (
                  <span className="spd-total">
                    {copy.assigned}: <strong className="sp-num">{data.assignedToYou}</strong>
                  </span>
                ) : null}
              </header>
              {data.recentProjects.length === 0 ? (
                <p className="spd-small">{copy.empty}</p>
              ) : (
                <ul className="spd-rows spd-rows-table">
                  {data.recentProjects.map((project) => (
                    <li key={project.id} data-weight={project.status === "COMPLETED" || project.status === "CANCELLED" ? "done" : undefined}>
                      <Link href={`/projects/${project.id}`} className="spd-code">
                        {project.projectCode}
                      </Link>
                      <span className="spd-row-title">{project.title}</span>
                      <StatusChip domain="project" status={project.status} label={label(project.status)} />
                      <time dateTime={project.updatedAt} className="spd-when">
                        {formatActivityWhen(project.updatedAt, locale)}
                      </time>
                      {canLinkProjectRecord(roleKey) ? (
                        <span className="spd-row-links">
                          <Link href={`/projects/${project.id}/timeline`}>
                            {copy.timeline}
                            <span className="mc-sr"> — {project.projectCode}</span>
                          </Link>
                          <Link href={`/projects/${project.id}/activity`}>
                            {copy.activity}
                            <span className="mc-sr"> — {project.projectCode}</span>
                          </Link>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/projects" className="mc-link">
                {copy.projects} →
              </Link>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
