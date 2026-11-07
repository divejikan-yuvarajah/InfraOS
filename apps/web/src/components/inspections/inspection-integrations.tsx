"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ProjectRecordNav, RecordContext } from "@/components/projects/project-record-nav";
import { ApiError } from "@/lib/api/client";
import { fetchContractorOutcomes, fetchProjectInspections } from "@/lib/inspections/api";
import { getInspectionCopy } from "@/lib/inspections/messages";
import { hintAssign, useInspectionKeys } from "@/lib/inspections/session";
import { fill, fmtDate } from "@/lib/inspections/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { ScheduleDialog } from "./inspection-dialogs";
import { Chip, EmptyState, ErrorState, PriorityChip, Skeletons, StatusBadge } from "./inspection-ui";

/** Roles that may hold inspection.read. The server is the authority; this only avoids a pointless request. */
const hintRead = (roleKey: string) => ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"].includes(roleKey);
export const hintInspections = hintRead;

/** "Reported X % · Verified Y %" next to the project's existing progress display. Renders nothing when the viewer cannot read inspections. */
export function VerifiedProgressChip({ projectId, reported }: { projectId: string; reported: number | null | undefined }) {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const { roleKey, key } = useInspectionKeys();
  const q = useQuery({ queryKey: key("project-chip", projectId), queryFn: () => fetchProjectInspections(projectId), enabled: hintRead(roleKey), retry: false, staleTime: 60_000 });
  if (!hintRead(roleKey) || q.isPending || q.isError) return null;
  const v = q.data.latestVerification;
  return (
    <p className="ctr-row" title={copy.project.basis} aria-label={copy.project.basis}>
      <Chip tone={v ? "success" : "neutral"} icon={<ShieldCheckIcon aria-hidden="true" />}>
        {v ? fill(copy.project.reportedVerified, { reported: reported ?? "—", verified: v.verifiedPercent }) : `${copy.project.reportedVerified.split("·")[0]!.replace("{reported}", String(reported ?? "—")).trim()} · ${copy.project.notVerified}`}
      </Chip>
      {v ? <span className="ins-muted">{fill(copy.project.asOf, { date: fmtDate(v.asOf, locale) })}</span> : null}
      <Link className="ins-link" href={`/projects/${projectId}/inspections`}>{copy.project.tab}</Link>
    </p>
  );
}

/** Progress page button: opens the schedule dialog prefilled for a verification inspection. */
export function RequestVerificationButton({ projectId, claimed }: { projectId: string; claimed: number | null }) {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const { roleKey } = useInspectionKeys();
  const [open, setOpen] = useState(false);
  if (!hintAssign(roleKey)) return null;
  return (
    <>
      <button type="button" className="ctr-btn" onClick={() => setOpen(true)}>{copy.schedule.requestVerification}</button>
      <ScheduleDialog open={open} onOpenChange={setOpen} copy={copy} locale={locale} initial={{ projectId, type: "PROGRESS_VERIFICATION", claimed }} />
    </>
  );
}

/** Project record tab: inspections list, open findings and the latest verification. */
export function ProjectInspectionsTab({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const { roleKey, key } = useInspectionKeys();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: key("project-tab", id), queryFn: () => fetchProjectInspections(id), retry: false });
  const v = q.data?.latestVerification;
  return (
    <StaffWorkspaceShell title={copy.project.tab} wide context={<RecordContext id={id} locale={locale} current={copy.project.tab} />}>
      <ProjectRecordNav id={id} locale={locale} />
      <div className="ins">
        {q.isPending ? <Skeletons /> : q.isError ? <ErrorState error={q.error} copy={copy} onRetry={() => void q.refetch()} /> : (
          <>
            <section className="ins-panel"><div className="ins-bar"><h2 className="ins-h">{copy.project.latest}</h2>
              <div className="ctr-row">{hintAssign(roleKey) ? <button type="button" className="ctr-btn is-primary" onClick={() => setOpen(true)}>{copy.project.schedule}</button> : null}<Link className="ctr-btn" href={`/inspections?projectId=${id}`}>{copy.nav.all}</Link></div></div>
              {v ? <p><Chip tone="success" icon={<ShieldCheckIcon aria-hidden="true" />}>{fill(copy.project.reportedVerified, { reported: v.claimedPercent ?? "—", verified: v.verifiedPercent })}</Chip> <span className="ins-muted">{fill(copy.project.asOf, { date: fmtDate(v.asOf, locale) })}</span></p> : <p className="ins-muted">{copy.project.notVerified}</p>}
              <p className="ins-muted">{copy.project.basis}</p>
            </section>
            <section className="ins-panel"><h2 className="ins-h">{copy.project.openFindings}</h2>
              {q.data.openFindings.length ? <ul className="ins-gaps">{q.data.openFindings.map((f) => <li key={`${f.inspectionNo}${f.key}`}><span><strong>{copy.report.sev[f.severity as keyof typeof copy.report.sev] ?? f.severity}</strong>: {f.title}</span><span className="ins-muted">{f.inspectionNo}</span></li>)}</ul> : <p className="ins-muted">{copy.project.noFindings}</p>}
            </section>
            {q.data.rows.length === 0 ? <EmptyState title={copy.project.none} /> : (
              <div className="ins-cards">{q.data.rows.map((r) => (
                <div key={r.id} className="ins-card" data-overdue={r.overdue}>
                  <div className="ins-card-top"><div><Link className="ins-link" href={`/inspections/${r.id}`}>{r.inspectionNo}</Link><br /><span className="ins-muted">{copy.type[r.inspectionType]} · {fmtDate(r.inspectionDate, locale)} · {r.inspectorName ?? "—"}</span></div><PriorityChip priority={r.priority} copy={copy} /></div>
                  <StatusBadge status={r.status} overdue={r.overdue} copy={copy} />
                </div>
              ))}</div>
            )}
          </>
        )}
      </div>
      <ScheduleDialog open={open} onOpenChange={setOpen} copy={copy} locale={locale} initial={{ projectId: id }} />
    </StaffWorkspaceShell>
  );
}

/** Read-only inspection outcomes on the contractor profile. Hidden when the viewer lacks the performance grant. */
export function ContractorInspectionsCard({ contractorId }: { contractorId: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const { roleKey, key } = useInspectionKeys();
  const q = useQuery({ queryKey: key("contractor", contractorId), queryFn: () => fetchContractorOutcomes(contractorId), enabled: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER"].includes(roleKey), retry: false });
  if (!["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER"].includes(roleKey)) return null;
  if (q.isError && q.error instanceof ApiError && (q.error.status === 403 || q.error.status === 404)) return null;
  return (
    <section className="sp-surface ctr-panel" aria-label={copy.contractor.title}>
      <h3>{copy.contractor.title}</h3>
      {q.isPending ? <p className="ctr-small" role="status">{copy.common.loading}</p> : q.isError ? <p className="ctr-error" role="alert">{copy.common.errorBody}</p> : (
        <>
          {q.data.inspections.length === 0 ? <p className="ctr-small">{copy.contractor.empty}</p> : (
            <ul className="ins-gaps">{q.data.inspections.slice(0, 8).map((i) => (
              <li key={i.id} style={{ background: "#f8fafc" }}>
                <span><Link className="ins-link" href={`/inspections/${i.id}`}>{i.inspectionNo}</Link> · {i.projectCode} · {copy.type[i.inspectionType]}<br /><span className="ins-muted">{fill(copy.contractor.defects, { minor: i.defects.minor, major: i.defects.major, critical: i.defects.critical })}{i.defects.rework ? ` · ${fill(copy.contractor.rework, { n: i.defects.rework })}` : ""}{i.revisionCycles ? ` · ${copy.contractor.revisions}: ${i.revisionCycles}` : ""}</span></span>
                <StatusBadge status={i.status as never} copy={copy} />
              </li>
            ))}</ul>
          )}
          {q.data.verifications.length ? <><strong>{copy.contractor.verifications}</strong><ul className="ins-gaps">{q.data.verifications.slice(0, 5).map((v) => <li key={v.inspectionId} style={{ background: "#f8fafc" }}><span>{fill(copy.contractor.claimedVsVerified, { c: v.claimedPercent ?? "—", v: v.verifiedPercent })} · <span className="ins-muted">{fmtDate(v.asOf, locale)}</span></span><Link className="ins-link" href={`/inspections/${v.inspectionId}`}>{copy.contractor.openInspection}</Link></li>)}</ul></> : null}
        </>
      )}
    </section>
  );
}
