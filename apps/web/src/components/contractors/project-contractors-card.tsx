"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { fetchProjectContractors } from "@/lib/contractors/api";
import { formatDate, formatLkr } from "@/lib/contractors/format";
import { getContractorCopy } from "@/lib/contractors/messages";
import { useContractorKeys } from "@/lib/contractors/session";
import type { Assignment } from "@/lib/contractors/types";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import "@/styles/contractors.css";

import { AssignmentStatusBadge, RoleBadge, Skeleton, StatusBadge } from "./contractor-badges";
import { AssignDialog, EndAssignmentDialog, ReassignWizard } from "./contractor-dialogs";

/**
 * The project page's Contractors card. Read-only for viewers without contractor.manage; the Assign, End and Replace actions appear only when the
 * server says this viewer may manage the project (`can`). A viewer with no contractor access sees nothing here, so the page is unchanged for them.
 */
export function ProjectContractorsCard({ projectId, projectLabel }: { projectId: string; projectLabel?: string }) {
  const keys = useContractorKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getContractorCopy(locale);
  const [assign, setAssign] = useState(false);
  const [ending, setEnding] = useState<Assignment | null>(null);
  const [reassign, setReassign] = useState<{ id?: string } | null>(null);
  const q = useQuery({ queryKey: keys.key("project", projectId), queryFn: () => fetchProjectContractors(projectId), retry: false });

  if (q.error instanceof ApiError && (q.error.status === 403 || q.error.status === 404)) return null;
  const rows = q.data?.rows ?? [];
  const active = rows.filter((r) => r.status === "ACTIVE");
  const history = rows.filter((r) => r.status !== "ACTIVE");
  const can = q.data?.can;
  const values = q.data?.valuesVisible ?? false;

  const renderRow = (a: Assignment, actions: boolean) => (
    <li key={a.id} className="ctr-match">
      {a.contractor ? <Link href={`/contractors/${a.contractor.id}`} style={{ fontWeight: 700 }}>{a.contractor.name}</Link> : <span className="ctr-muted">{copy.common.unknown}</span>}
      <RoleBadge role={a.role} copy={copy} />
      {a.status === "ACTIVE" ? (a.contractor ? <StatusBadge status={a.contractor.status as "ACTIVE"} copy={copy} /> : null) : <AssignmentStatusBadge status={a.status} copy={copy} />}
      <span className="ctr-small">{formatDate(a.startDate, locale)}{a.endDate ? ` → ${formatDate(a.endDate, locale)}` : ""}</span>
      {a.contractReference ? <span className="ctr-small">{a.contractReference}</span> : null}
      {values && a.contractValue ? <span className="ctr-small ctr-num">{copy.projectCard.values}: {formatLkr(a.contractValue.amountMinor, locale)}</span> : null}
      {actions && can?.manage ? (
        <span className="ctr-row">
          <button type="button" className="ctr-btn is-ghost" onClick={() => setReassign({ id: a.id })}>{copy.projectCard.reassign}</button>
          <button type="button" className="ctr-btn is-ghost" onClick={() => setEnding(a)}>{copy.projectCard.end}</button>
        </span>
      ) : null}
    </li>
  );

  return (
    <section className="sp-surface ctr-panel" aria-labelledby="project-contractors">
      <div className="ctr-bar">
        <h3 id="project-contractors">{copy.projectCard.title}</h3>
        {can?.assign ? <button type="button" className="ctr-btn" onClick={() => setAssign(true)}>{copy.projectCard.assign}</button> : null}
      </div>
      {q.isLoading ? <Skeleton height="2.5rem" /> : null}
      {q.error ? <div role="alert"><p className="ctr-error">{copy.projectCard.loadFailed}</p><button type="button" className="ctr-btn" onClick={() => void q.refetch()}>{copy.common.retry}</button></div> : null}
      {q.data && rows.length === 0 ? <p className="ctr-small">{copy.projectCard.empty}</p> : null}
      {active.length ? <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>{active.map((a) => renderRow(a, true))}</ul> : null}
      {history.length ? <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem", opacity: 0.85 }} aria-label={copy.projects.segCompleted}>{history.map((a) => renderRow(a, false))}</ul> : null}
      {q.data && !can?.assign && q.data.projectStatus && ["COMPLETED", "CANCELLED", "REJECTED"].includes(q.data.projectStatus) ? <p className="ctr-small">{copy.projectCard.closed}</p> : null}

      <AssignDialog open={assign} onOpenChange={setAssign} copy={copy} locale={locale} project={{ id: projectId, label: projectLabel ?? projectId }} onNeedReassign={(_, assignmentId) => setReassign({ id: assignmentId })} />
      {ending ? <EndAssignmentDialog open onOpenChange={(o) => { if (!o) setEnding(null); }} copy={copy} locale={locale} projectId={projectId} assignment={ending} additional={active.filter((a) => a.role === "ADDITIONAL")} /> : null}
      {reassign ? <ReassignWizard open onOpenChange={(o) => { if (!o) setReassign(null); }} copy={copy} locale={locale} projectId={projectId} assignments={rows} initialAssignmentId={reassign.id} /> : null}
    </section>
  );
}
