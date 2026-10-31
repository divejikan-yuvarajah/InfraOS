"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProjectStatus } from "@infraos/shared-types";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  ClockIcon,
  FolderKanbanIcon,
  PauseCircleIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { MotifIllustration, SurveyGrid } from "@/components/motif/connected-motif";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { projectStatusVisual } from "@/lib/design/semantic-colors";
import { fetchProjectDashboard } from "@/lib/projects/dashboard-api";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import {
  STATUS_TONE,
  attentionItems,
  canLinkProjectRecord,
  dashboardCards,
  dashboardIsEmpty,
  dashboardIsPartial,
  dashboardQueryKey,
  dashboardScope,
  donutSegments,
  statusLabel,
  statusRows,
  visibleDashboard,
  type DashboardPayload,
} from "@/lib/projects/dashboard-view";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { formatActivityWhen } from "@/lib/projects/activity-view";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function money(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = String(Math.abs(minor % 100)).padStart(2, "0");
  return `LKR ${new Intl.NumberFormat("en-LK").format(whole)}.${cents}`;
}

const CARD_META = {
  total: { icon: FolderKanbanIcon, tone: "neutral", href: "/projects" },
  active: { icon: ActivityIcon, tone: "active", href: "/projects?status=ACTIVE" },
  onHold: { icon: PauseCircleIcon, tone: "neutral", href: "/projects?status=ON_HOLD" },
  delayed: { icon: AlertTriangleIcon, tone: "critical", href: "/projects?status=DELAYED" },
  reportedOpen: { icon: CheckCircle2Icon, tone: "pending", href: null },
  reviews: { icon: ClipboardCheckIcon, tone: "pending", href: "/projects/reviews" },
} as const;

type CardId = keyof typeof CARD_META;

const statusClass = (status: string) =>
  `is-${STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral"} is-${status.toLowerCase()}`;

function StatusDonut({ data, label }: { data: DashboardPayload; label: string }) {
  const segments = donutSegments(data);
  const circumference = 2 * Math.PI * 48;
  const gap = segments.length > 1 ? 2 : 0;
  const starts = segments.map((_, i) => segments.slice(0, i).reduce((sum, seg) => sum + seg.fraction * circumference, 0));
  return (
    <div className="mc-donut-wrap">
      <svg
        viewBox="0 0 120 120"
        className="mc-donut"
        role="img"
        aria-label={`${label}: ${segments.map((s) => `${statusLabel(s.status)} ${s.count}`).join(", ")}`}
      >
        <circle cx="60" cy="60" r="48" fill="none" stroke="#eef2f6" strokeWidth="14" />
        {segments.map((seg, i) => {
          const len = Math.max(seg.fraction * circumference - gap, 0.5);
          const start = starts[i] ?? 0;
          return (
            <circle
              key={seg.status}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              strokeWidth="14"
              className={`mc-seg ${statusClass(seg.status)}`}
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-start}
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>
      <p className="mc-donut-center">
        <span>{data.counts.total}</span>
      </p>
    </div>
  );
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

  const cardLabel = (id: CardId) =>
    id === "total"
      ? copy.total
      : id === "active"
        ? copy.active
        : id === "onHold"
          ? copy.onHold
          : id === "delayed"
            ? copy.delayed
            : id === "reportedOpen"
              ? copy.reportedOpen
              : copy.reviews;
  const attentionLabel = (id: string, count: number) =>
    id === "delayed"
      ? `${copy.delayed}: ${count}`
      : id === "reviews"
        ? `${copy.reviews}: ${count}`
        : id === "overdue"
          ? `${copy.overdue}: ${count}`
          : `${copy.reportedOpen}: ${count}`;

  const attention = data ? attentionItems(data) : [];
  const empty = data ? dashboardIsEmpty(data) : false;

  return (
    <section className="mc-dash" aria-label={copy.title}>
      <div className="mc-dash-toolbar">
        <p className="mc-caption" role="status">
          {copy.nativeReview}
        </p>
        <div className="mc-segmented" role="group" aria-label={copy.language}>
          {(["en", "si", "ta"] as const).map((item) => (
            <button
              key={item}
              type="button"
              lang={item}
              className={locale === item ? "is-current" : undefined}
              aria-pressed={locale === item}
              onClick={() => onLocale(item)}
            >
              {item === "en" ? copy.english : item === "si" ? copy.sinhala : copy.tamil}
            </button>
          ))}
        </div>
      </div>
      {query.isPending && signedIn ? (
        <div className="mc-kpis mc-skeleton" role="status" aria-label={copy.loading}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="mc-skel" />
          ))}
        </div>
      ) : null}
      {notice ? (
        <div className="mc-alert is-critical" role="alert">
          <AlertTriangleIcon aria-hidden="true" />
          <p>{notice}</p>
          {failure !== "denied" && failure !== "expired" ? (
            <button type="button" className="mc-btn" onClick={() => void query.refetch()}>
              {copy.retry}
            </button>
          ) : null}
        </div>
      ) : null}
      {data ? (
        <>
          <p className="mc-provenance">
            <strong>
              {data.scope === "platform" ? copy.scopePlatform : data.scope === "assigned" ? copy.scopeAssigned : copy.scopeAgency}
            </strong>
            <span aria-hidden="true"> · </span>
            {copy.asOf} <time dateTime={data.asOf}>{formatActivityWhen(data.asOf, locale)}</time>
          </p>
          {dashboardIsPartial(data) ? (
            <p className="mc-note" role="status">
              {copy.milestonesUnavailable}
            </p>
          ) : null}

          <ul className="mc-kpis">
            {dashboardCards(data).map((card) => {
              const id = card.id as CardId;
              const meta = CARD_META[id];
              const Icon = meta.icon;
              const href = meta.href;
              const inner = (
                <>
                  <span className={`mc-chip is-${meta.tone}`}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="mc-kpi-label">{cardLabel(id)}</span>
                  <span className="mc-kpi-value">{card.value === null ? "—" : card.value}</span>
                  {id !== "total" && card.value !== null ? (
                    <span className="mc-kpi-context">
                      / {data.counts.total} {copy.total.toLowerCase()}
                    </span>
                  ) : null}
                  {card.value === null ? <span className="mc-kpi-context">{copy.kpiRoleLimited}</span> : null}
                </>
              );
              return (
                <li key={card.id} className={`mc-kpi is-${meta.tone}`}>
                  {href && card.value !== null ? (
                    <Link href={href} className="mc-kpi-link">
                      {inner}
                    </Link>
                  ) : (
                    <div className="mc-kpi-link">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mc-bento">
            <section className="mc-panel mc-insight" aria-labelledby="mc-attention">
              <SurveyGrid className="mc-insight-grid" />
              <h2 id="mc-attention">{copy.attention}</h2>
              {attention.length === 0 ? (
                <div className="mc-calm">
                  <MotifIllustration kind={empty ? "no-projects" : "all-clear"} className="mc-illustration" />
                  <p role="status">{empty ? copy.empty : copy.attentionClear}</p>
                  {empty ? (
                    <Link href="/projects" className="mc-link">
                      {copy.projects} →
                    </Link>
                  ) : null}
                </div>
              ) : (
                <ul className="mc-attention-list">
                  {attention.map((item) => {
                    const Icon =
                      item.id === "reviews"
                        ? ClipboardCheckIcon
                        : item.id === "reportedOpen"
                          ? CheckCircle2Icon
                          : item.id === "overdue"
                            ? ClockIcon
                            : AlertTriangleIcon;
                    const row = (
                      <>
                        <Icon aria-hidden="true" />
                        <span>{attentionLabel(item.id, item.count)}</span>
                        {item.href ? <span className="mc-link-hint">{copy.viewList} →</span> : null}
                      </>
                    );
                    return (
                      <li key={item.id} className={item.id === "delayed" || item.id === "overdue" ? "is-critical" : "is-pending"}>
                        {item.href ? <Link href={item.href}>{row}</Link> : <div>{row}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mc-caption">
                {copy.physicalMeaning} {copy.completedByStatus}: {data.physical.completedByStatus}.
              </p>
            </section>

            <section className="mc-panel mc-status" aria-labelledby="project-dashboard-status">
              <h2 id="project-dashboard-status">{copy.statusChart}</h2>
              <p className="mc-caption">
                {copy.total}: {data.counts.total}
              </p>
              {donutSegments(data).length === 0 ? (
                <div className="mc-calm">
                  <MotifIllustration kind="no-projects" className="mc-illustration" />
                  <p>{copy.empty}</p>
                </div>
              ) : (
                <>
                  <StatusDonut data={data} label={copy.statusChart} />
                  <ul className="mc-legend">
                    {donutSegments(data).map((seg) => (
                      <li key={seg.status}>
                        <span className={`mc-swatch ${statusClass(seg.status)}`} aria-hidden="true" />
                        <span>{statusLabel(seg.status)}</span>
                        <span className="mc-num">
                          {seg.count} · {Math.round(seg.fraction * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <details className="mc-details">
                <summary>{copy.statusTable}</summary>
                <table className="mc-table-mini" id="project-dashboard-table">
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
                        <th scope="row">{statusLabel(row.status)}</th>
                        <td className="mc-num">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>

            <section className="mc-panel mc-milestones" aria-labelledby="project-dashboard-milestones">
              <h2 id="project-dashboard-milestones">{copy.milestones}</h2>
              {data.milestones ? (
                <>
                  <div
                    className="mc-split-bar"
                    role="img"
                    aria-label={`${copy.overdue}: ${data.milestones.overdue}. ${copy.due}: ${data.milestones.dueWithin14Days}.`}
                  >
                    {data.milestones.overdue + data.milestones.dueWithin14Days === 0 ? (
                      <span className="is-empty" />
                    ) : (
                      <>
                        <span className="is-critical" style={{ flexGrow: data.milestones.overdue }} />
                        <span className="is-pending" style={{ flexGrow: data.milestones.dueWithin14Days }} />
                      </>
                    )}
                  </div>
                  <ul className="mc-legend">
                    <li>
                      <span className="mc-swatch is-critical" aria-hidden="true" />
                      <span>{copy.overdue}</span>
                      <span className="mc-num">{data.milestones.overdue}</span>
                    </li>
                    <li>
                      <span className="mc-swatch is-pending" aria-hidden="true" />
                      <span>{copy.due}</span>
                      <span className="mc-num">{data.milestones.dueWithin14Days}</span>
                    </li>
                  </ul>
                  <ul className="mc-rows">
                    {data.milestones.items.map((item) => (
                      <li key={item.id}>
                        <Link href={`/projects/${item.projectId}`} className="mc-code">
                          {item.projectCode}
                        </Link>
                        <span className="mc-row-title">{item.title}</span>
                        <StatusBadge
                          size="sm"
                          variant={item.classification === "overdue" ? "critical" : "pending"}
                          label={item.classification === "overdue" ? copy.overdue : copy.due}
                        />
                        <time dateTime={item.plannedEnd}>{formatActivityWhen(item.plannedEnd, locale)}</time>
                      </li>
                    ))}
                  </ul>
                  <p className="mc-caption">{copy.plannedMeaning}</p>
                </>
              ) : (
                <div className="mc-calm">
                  <MotifIllustration kind="unavailable" className="mc-illustration" />
                  <p>{copy.milestonesUnavailable}</p>
                </div>
              )}
            </section>

            <section className="mc-panel mc-finance" aria-labelledby="project-dashboard-finance">
              <h2 id="project-dashboard-finance">
                {copy.finance} <span className="mc-tag">{copy.provisional}</span>
              </h2>
              {data.finance ? (
                <>
                  <p className="mc-big">{money(data.finance.storedPaidAmountMinor)}</p>
                  <p className="mc-caption">
                    {data.finance.storedPaidCount} · {copy.financeMeaning}
                  </p>
                </>
              ) : (
                <div className="mc-calm">
                  <MotifIllustration kind="unavailable" className="mc-illustration" />
                  <p>{data.coverage.finance === "unavailable" ? copy.financeSourceDown : copy.financeUnavailable}</p>
                </div>
              )}
            </section>

            <section className="mc-panel mc-recent" aria-labelledby="mc-recent-h">
              <h2 id="mc-recent-h">{copy.recent}</h2>
              {data.recentProjects.length === 0 ? (
                <p className="mc-caption">{copy.empty}</p>
              ) : (
                <ul className="mc-rows">
                  {data.recentProjects.map((project) => (
                    <li key={project.id}>
                      <Link href={`/projects/${project.id}`} className="mc-code">
                        {project.projectCode}
                      </Link>
                      <span className="mc-row-title">{project.title}</span>
                      <StatusBadge
                        size="sm"
                        variant={projectStatusVisual(project.status as ProjectStatus)}
                        label={statusLabel(project.status)}
                      />
                      <time dateTime={project.updatedAt}>{formatActivityWhen(project.updatedAt, locale)}</time>
                      {canLinkProjectRecord(roleKey) ? (
                        <span className="mc-row-links">
                          <Link href={`/projects/${project.id}/timeline`}>{copy.timeline}</Link>
                          <Link href={`/projects/${project.id}/activity`}>{copy.activity}</Link>
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

            {data.reviews ? (
              <section className="mc-panel mc-reviews" aria-labelledby="project-dashboard-reviews">
                <h2 id="project-dashboard-reviews">{copy.reviews}</h2>
                <p className="mc-big">{data.reviews.pending}</p>
                <ul className="mc-rows">
                  {data.reviews.items.map((item) => (
                    <li key={item.id}>
                      <Link href={`/projects/${item.id}/review`} className="mc-code">
                        {item.projectCode}
                      </Link>
                      <span className="mc-row-title">{item.title}</span>
                      <StatusBadge size="sm" variant="pending" label={statusLabel(item.status)} />
                    </li>
                  ))}
                </ul>
                <Link href="/projects/reviews" className="mc-link">
                  {copy.reviewQueue} →
                </Link>
              </section>
            ) : null}
          </div>
          {typeof data.assignedToYou === "number" ? (
            <p className="mc-caption">
              {copy.assigned}: {data.assignedToYou}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
