"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import { fetchAssignments } from "@/lib/contractors/api";
import { fill, formatDate, formatLkr } from "@/lib/contractors/format";
import type { Copy } from "@/lib/contractors/messages";
import { useContractorKeys } from "@/lib/contractors/session";
import type { Assignment } from "@/lib/contractors/types";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import { dashboardStatusLabel } from "@/lib/projects/dashboard-view";

import { AssignmentStatusBadge, Badge, RoleBadge, Skeleton } from "./contractor-badges";

type View = "active" | "completed" | "all";

function useProjectStatus(locale: AuthLocale) {
  const dash = getDashboardCopy(locale);
  return (status: string) => dashboardStatusLabel(status, dash);
}

function Outcome({ a, copy }: { a: Assignment; copy: Copy }) {
  if (!a.inspectionOutcome) return <span className="ctr-muted">{copy.inspection.none}</span>;
  const tone = a.inspectionOutcome === "VERIFIED" ? "success" : a.inspectionOutcome === "REJECTED" ? "critical" : "pending";
  return <Badge tone={tone}>{copy.inspection[a.inspectionOutcome as "VERIFIED"] ?? a.inspectionOutcome} · {copy.inspection.coarse}</Badge>;
}

function Delay({ a, copy }: { a: Assignment; copy: Copy }) {
  if (a.delayDays === null) return <span className="ctr-muted">—</span>;
  return a.delayDays > 0 ? <Badge tone="critical">{fill(copy.projects.delayDays, { n: a.delayDays })}</Badge> : <Badge tone="success">{copy.projects.onTime}</Badge>;
}

function ContractText({ a, copy, locale, values }: { a: Assignment; copy: Copy; locale: AuthLocale; values: boolean }) {
  return (
    <>
      {a.contractReference ? <span>{fill(copy.projects.contractRef, { ref: a.contractReference })}</span> : null}
      {values ? (a.contractValue ? <span className="ctr-num">{formatLkr(a.contractValue.amountMinor, locale)}</span> : null) : <span className="ctr-muted">{copy.projects.valueHidden}</span>}
    </>
  );
}

function TimelineItem({ a, copy, locale, values, statusName }: { a: Assignment; copy: Copy; locale: AuthLocale; values: boolean; statusName: (s: string) => string }) {
  return (
    <li className="ctr-tl-item" data-status={a.status}>
      <div className="ctr-tl-head">
        <Link href={`/projects/${a.project.id}/overview`}><span className="ctr-code">{a.project.code}</span> {a.project.title}</Link>
        <RoleBadge role={a.role} copy={copy} />
        <AssignmentStatusBadge status={a.status} copy={copy} />
        <Delay a={a} copy={copy} />
      </div>
      <div className="ctr-tl-meta">
        {a.project.agencyName ? <span>{a.project.agencyName}</span> : null}
        {a.project.locationText ? <span>{a.project.locationText}</span> : null}
        <span>{formatDate(a.startDate, locale)} → {a.endDate ? formatDate(a.endDate, locale) : a.project.plannedEndDate ? fill(copy.projects.plannedEnd, { date: formatDate(a.project.plannedEndDate, locale) }) : copy.projects.ongoing}</span>
        <span>{statusName(a.project.status)}</span>
        <ContractText a={a} copy={copy} locale={locale} values={values} />
        <Outcome a={a} copy={copy} />
        {a.project.locationText ? <Link href={`/inframap?sel=projects:${a.project.id}`} aria-label={`${copy.projects.viewOnMap}: ${a.project.code}`}><MapPinIcon aria-hidden="true" width={14} height={14} style={{ display: "inline" }} /> {copy.projects.viewOnMap}</Link> : null}
      </div>
      {a.endReason ? <p className="ctr-small">{a.endReason}</p> : null}
      {a.successor ? <p className="ctr-tl-link">↳ {fill(copy.projects.replacedBy, { name: a.successor.name ?? copy.common.unknown })}</p> : null}
    </li>
  );
}

export function ProjectsPanel({ id, copy, locale }: { id: string; copy: Copy; locale: AuthLocale }) {
  const keys = useContractorKeys();
  const statusName = useProjectStatus(locale);
  const [view, setView] = useState<View>("all");
  const [layout, setLayout] = useState<"timeline" | "table">("timeline");
  const q = useQuery({ queryKey: keys.key("assignments", id, view), queryFn: () => fetchAssignments(id, view), retry: false });
  const rows = q.data?.rows ?? [];
  const values = q.data?.valuesVisible ?? false;
  const years = [...new Set(rows.map((r) => (r.startDate ?? "").slice(0, 4)))].sort().reverse();

  return (
    <section className="sp-surface ctr-panel" aria-label={copy.projects.title}>
      <div className="ctr-bar">
        <h2>{copy.projects.title}</h2>
        <div className="ctr-row">
          <div className="ctr-seg" role="group" aria-label={copy.projects.title}>
            {(["all", "active", "completed"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "all" ? copy.projects.segAll : v === "active" ? copy.projects.segActive : copy.projects.segCompleted}</button>)}
          </div>
          <div className="ctr-seg" role="group" aria-label={copy.projects.view}>
            {(["timeline", "table"] as const).map((v) => <button key={v} type="button" aria-pressed={layout === v} onClick={() => setLayout(v)}>{v === "timeline" ? copy.projects.timeline : copy.projects.table}</button>)}
          </div>
        </div>
      </div>
      {q.data ? <p className="ctr-small" role="status">{fill(copy.projects.totals, { active: q.data.counts.active, ended: q.data.counts.ended })}</p> : null}
      {q.isLoading ? <><Skeleton height="3rem" /><Skeleton height="3rem" /></> : null}
      {q.error ? <div role="alert"><p className="ctr-error">{copy.common.unavailable}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {!q.isLoading && !q.error && rows.length === 0 ? <p className="ctr-small">{copy.projects.empty}</p> : null}

      {layout === "timeline" && rows.length ? (
        <ol className="ctr-tl" aria-label={copy.projects.timeline}>
          {years.map((year) => (
            <li key={year} style={{ listStyle: "none" }}>
              <p className="ctr-tl-year">{year || "—"}</p>
              <ol className="ctr-tl">{rows.filter((r) => (r.startDate ?? "").slice(0, 4) === year).map((a) => <TimelineItem key={a.id} a={a} copy={copy} locale={locale} values={values} statusName={statusName} />)}</ol>
            </li>
          ))}
        </ol>
      ) : null}

      {layout === "table" && rows.length ? (
        <div style={{ overflowX: "auto" }}>
          <table className="ctr-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }} aria-label={copy.projects.title}>
            <thead>
              <tr>{[copy.projects.columns.project, copy.projects.columns.agency, copy.projects.columns.role, copy.projects.columns.dates, copy.projects.columns.delay, copy.projects.columns.status, copy.projects.columns.contract, copy.projects.columns.outcome, copy.projects.columns.ended].map((h) => <th key={h} scope="col" style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--infra-border)" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td style={{ padding: "0.5rem" }}><Link href={`/projects/${a.project.id}/overview`}><span className="ctr-code">{a.project.code}</span> {a.project.title}</Link></td>
                  <td style={{ padding: "0.5rem" }}>{a.project.agencyName ?? "—"}</td>
                  <td style={{ padding: "0.5rem" }}><RoleBadge role={a.role} copy={copy} /> <AssignmentStatusBadge status={a.status} copy={copy} /></td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{formatDate(a.startDate, locale)} → {a.endDate ? formatDate(a.endDate, locale) : "…"}</td>
                  <td style={{ padding: "0.5rem" }}><Delay a={a} copy={copy} /></td>
                  <td style={{ padding: "0.5rem" }}>{statusName(a.project.status)}</td>
                  <td style={{ padding: "0.5rem" }}><div className="ctr-row"><ContractText a={a} copy={copy} locale={locale} values={values} /></div></td>
                  <td style={{ padding: "0.5rem" }}><Outcome a={a} copy={copy} /></td>
                  <td style={{ padding: "0.5rem" }}>{a.endReason ?? "—"}{a.successor ? ` ↳ ${a.successor.name ?? ""}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="ctr-small">{copy.projects.footnote}</p>
    </section>
  );
}
