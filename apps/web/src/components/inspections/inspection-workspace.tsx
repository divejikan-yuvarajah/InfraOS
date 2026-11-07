"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUrlParams } from "@/lib/finance/url-state";
import { decideInspection, fetchInspection, fetchVerifiedSeries, startInspection } from "@/lib/inspections/api";
import { getInspectionCopy, type Copy } from "@/lib/inspections/messages";
import { useInspectionKeys } from "@/lib/inspections/session";
import type { AuthLocale } from "@/lib/auth/types";
import { DISCREPANCY_THRESHOLD_PP, type InspectionDetail, type InspectionRow, type Report } from "@/lib/inspections/types";
import { discrepancy, fill, fmtDate, fmtDateTime, fmtTime, isProgressType, overThreshold } from "@/lib/inspections/view";
import { fetchMilestones } from "@/lib/projects/milestones-api";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { EvidencePanel } from "./evidence-panel";
import { CancelDialog, ReassignDialog, RescheduleDialog, ScheduleDialog, useRefreshInspections } from "./inspection-dialogs";
import { DualGauge, ErrorState, Field, InspectionStepper, PriorityChip, Skeletons, Sparkline, StatusBadge, errorText, ppText } from "./inspection-ui";

type Tab = "overview" | "report" | "evidence" | "verification" | "history" | "review";
type Common = { copy: Copy; locale: AuthLocale };

const toRow = (d: InspectionDetail): InspectionRow => ({
  id: d.id, inspectionNo: d.inspectionNo, projectId: d.project?.id ?? "", projectCode: d.project?.projectCode ?? null, projectTitle: d.project?.title ?? null, agencyId: d.agencyId, inspectionType: d.inspectionType, priority: d.priority,
  status: d.status, inspectionDate: d.inspectionDate, durationMinutes: d.durationMinutes, inspectorId: d.inspector.id, inspectorName: d.inspector.name, overdue: d.overdue, evidenceCount: d.evidence.filter((e) => e.status === "ACTIVE").length,
  submissionCount: d.submissions.length, claimedProgress: d.claimedProgressAtSchedule, measuredProgress: d.measuredProgress, discrepancyPp: discrepancy(d.measuredProgress, d.claimedProgressAtSchedule), version: d.version,
});

function ReportView({ report, d, copy }: { report: Report; d: InspectionDetail; copy: Copy }) {
  const labels = copy.checklist as Record<string, string>;
  const ordered = [...report.checklist].sort((a, b) => Number(b.result === "FAIL") - Number(a.result === "FAIL"));
  const sev = (s: string) => report.defects.filter((x) => x.severity === s);
  return (
    <div className="ins">
      <section className="ins-panel"><h3 className="ins-h">{copy.review.failedFirst}</h3>
        <ul className="ins-gaps">{ordered.map((c) => <li key={c.key} style={c.result === "FAIL" ? { background: "var(--sp-tint-critical)" } : { background: "#f8fafc" }}><span><strong>{labels[c.key] ?? c.key}</strong>{c.note ? <><br /><span className="ins-muted">{c.note}</span></> : null}</span><span className="ins-badge">{c.result === "PASS" ? copy.report.pass : c.result === "FAIL" ? copy.report.fail : c.result === "NA" ? copy.report.na : copy.workspace.notChecked}</span></li>)}</ul>
      </section>
      {[[copy.report.siteObservations, report.siteObservations], [copy.report.workObservations, report.workCompletionObservations], [copy.report.safetyObservations, report.safetyObservations], [copy.workspace.recommendations, report.recommendations]].map(([t, v]) => v ? <section key={t} className="ins-panel"><h3 className="ins-h">{t}</h3><p style={{ whiteSpace: "pre-wrap" }}>{v}</p></section> : null)}
      <section className="ins-panel"><h3 className="ins-h">{copy.review.defectsBySeverity}</h3>
        {report.defects.length === 0 ? <p className="ins-muted">{copy.report.noDefects}</p> : (["CRITICAL", "MAJOR", "MINOR"] as const).map((s) => sev(s).map((df) => (
          <div key={df.key} className="ins-item" data-fail={s === "CRITICAL"}><strong>{copy.report.sev[s]}: {df.title}</strong>{df.location ? <span className="ins-muted">{df.location}</span> : null}{df.description ? <p>{df.description}</p> : null}{df.reworkRequired ? <span className="ins-badge">{copy.report.reworkRequired}</span> : null}<span className="ins-muted">{fill(copy.report.linkedPhotos, { n: d.evidence.filter((e) => e.defectKey === df.key && e.status === "ACTIVE").length })}</span></div>
        )))}
      </section>
      {report.discrepancyNote ? <section className="ins-note"><strong>{copy.report.discrepancyNote}</strong><p>{report.discrepancyNote}</p></section> : null}
    </div>
  );
}

function DecisionDialog({ mode, d, onClose, copy, locale }: Common & { mode: "APPROVE" | "REQUEST_REVISION" | "REJECT" | null; d: InspectionDetail; onClose: () => void }) {
  const refresh = useRefreshInspections();
  const [note, setNote] = useState(""); const [ack, setAck] = useState(false); const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<{ itemKey: string; comment: string }[]>([]);
  const [pick, setPick] = useState(""); const [text, setText] = useState("");
  const [done, setDone] = useState<{ pct: number | null } | null>(null);
  const last = d.submissions[d.submissions.length - 1];
  const measured = last?.report.measuredProgress ?? d.measuredProgress;
  const progress = isProgressType(d.inspectionType) && measured !== undefined && measured !== null;
  const big = progress && overThreshold(measured, d.claimedProgressAtSchedule ?? d.project?.reportedProgress ?? null);
  const labels = copy.checklist as Record<string, string>;
  const m = useMutation({
    mutationFn: () => decideInspection(d.id, { decision: mode, ...(note.trim() ? { note: note.trim() } : {}), itemComments: comments, ...(mode === "APPROVE" && big ? { acknowledgeDiscrepancy: ack } : {}) }),
    onSuccess: (r) => { void refresh(); if (mode === "APPROVE") setDone({ pct: r.verifiedPercent }); else { toast.success(mode === "REJECT" ? copy.review.decision.rejected : copy.review.decision.revisionSent); onClose(); } },
    onError: (e) => setError(errorText(e, copy)),
  });
  const needNote = mode !== "APPROVE";
  const valid = (!needNote || note.trim().length >= 12) && (mode !== "APPROVE" || !big || ack);
  const dec = copy.review.decision;
  const title = mode === "APPROVE" ? dec.approveTitle : mode === "REJECT" ? dec.rejectTitle : dec.revisionTitle;

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => { if (!o) { onClose(); setDone(null); setNote(""); setAck(false); setError(null); setComments([]); } }}>
      <DialogContent className="sm:max-w-lg ctr-dialog max-h-[90vh] overflow-y-auto">
        {done ? (
          <>
            <DialogHeader><DialogTitle>{done.pct !== null ? fill(dec.doneTitle, { pct: done.pct }) : dec.approved}</DialogTitle><DialogDescription>{copy.project.basis}</DialogDescription></DialogHeader>
            <div className="ctr-row">{d.project ? <Link className="ctr-btn is-primary" href={`/projects/${d.project.id}/progress`}>{dec.doneLinks}</Link> : null}{d.project ? <Link className="ctr-btn" href={`/projects/${d.project.id}/finance`}>{dec.financeLink}</Link> : null}<button type="button" className="ctr-btn" onClick={() => { onClose(); setDone(null); }}>{copy.common.close}</button></div>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{mode === "APPROVE" ? (progress ? fill(dec.approveBody, { pct: measured ?? "—", date: fmtDate(d.inspectionDate, locale) }) : dec.approveNoProgress) : mode === "REJECT" ? dec.rejectBody : dec.revisionBody}</DialogDescription></DialogHeader>
            <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (valid) m.mutate(); }}>
              {mode === "APPROVE" && big ? <><p className="ins-warn ins-bad"><AlertTriangleIcon aria-hidden="true" />{fill(copy.review.discrepancyBody, { pp: Math.abs(discrepancy(measured, d.claimedProgressAtSchedule ?? d.project?.reportedProgress ?? null) ?? 0) })}</p><label className="ins-toggle"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />{dec.acknowledge}</label></> : null}
              {needNote || mode === "APPROVE" ? <Field label={dec.note} hint={needNote ? dec.noteHint : undefined} error={needNote && note && note.trim().length < 12 ? dec.noteHint : null}>{(id) => <textarea id={id} className="ctr-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}</Field> : null}
              {mode === "REQUEST_REVISION" ? (
                <div className="ins-panel"><strong>{dec.itemCommentsTitle}</strong>
                  {comments.map((c, i) => <p key={i} className="ins-muted"><strong>{labels[c.itemKey] ?? c.itemKey}</strong>: {c.comment} <button type="button" className="ctr-btn is-ghost" onClick={() => setComments(comments.filter((_, j) => j !== i))} aria-label={copy.common.clear}>×</button></p>)}
                  <div className="ctr-row"><Field label={dec.itemPick}>{(id) => <select id={id} className="ctr-input" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">{copy.common.choose}</option>{d.checklist.items.map((i) => <option key={i.key} value={i.key}>{labels[i.key] ?? i.key}</option>)}</select>}</Field>
                    <Field label={dec.itemComment}>{(id) => <input id={id} className="ctr-input" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />}</Field></div>
                  <button type="button" className="ctr-btn" disabled={!pick || !text.trim() || comments.length >= 40} onClick={() => { setComments([...comments, { itemKey: pick, comment: text.trim() }]); setPick(""); setText(""); }}>{dec.addComment}</button>
                </div>
              ) : null}
              {error ? <p className="ctr-error" role="alert">{error}</p> : null}
              <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button>
                <button type="submit" className={mode === "REJECT" ? "ctr-btn is-danger" : "ctr-btn is-primary"} disabled={!valid || m.isPending}>{m.isPending ? copy.common.working : mode === "APPROVE" ? dec.confirmApprove : mode === "REJECT" ? dec.confirmReject : dec.confirmRevision}</button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InspectionWorkspace({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const router = useRouter();
  const qc = useQueryClient();
  const url = useUrlParams();
  const { key } = useInspectionKeys();
  const refresh = useRefreshInspections();
  const detail = useQuery({ queryKey: key("detail", id), queryFn: ({ signal }) => fetchInspection(id, signal) });
  const d = detail.data;
  const [sub, setSub] = useState<string>("current");
  const [dialog, setDialog] = useState<"reschedule" | "reassign" | "cancel" | "follow" | null>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REQUEST_REVISION" | "REJECT" | null>(null);
  const milestones = useQuery({ queryKey: key("milestones", d?.project?.id), queryFn: () => fetchMilestones(d!.project!.id), enabled: Boolean(d?.project) && Boolean(d?.milestoneIds.length) });
  const series = useQuery({ queryKey: key("series", d?.project?.id), queryFn: () => fetchVerifiedSeries(d!.project!.id), enabled: Boolean(d?.project) && (isProgressType(d?.inspectionType ?? "QUALITY") || Boolean(d?.verification)) });
  const start = useMutation({ mutationFn: () => startInspection(id), onSuccess: () => { toast.success(copy.dialogs.started); void refresh(); router.push(`/inspections/${id}/report`); }, onError: (e) => toast.error(errorText(e, copy)) });
  const row = useMemo(() => (d ? toRow(d) : null), [d]);

  const reviewer = Boolean(d && (d.can.approve || d.can.reject) && d.status === "SUBMITTED");
  const tabs: Tab[] = ["overview", "report", "evidence", ...(d && (isProgressType(d.inspectionType) || d.verification) ? ["verification" as const] : []), "history", ...(reviewer ? ["review" as const] : [])];
  const requested = url.get("tab") as Tab;
  const tab: Tab = tabs.includes(requested) ? requested : reviewer ? "review" : "overview";
  const setTab = (t: Tab) => url.set({ tab: t });

  if (detail.isPending) return <StaffWorkspaceShell title={copy.workspace.title} wide><Skeletons /></StaffWorkspaceShell>;
  if (detail.isError || !d || !row) return <StaffWorkspaceShell title={copy.workspace.title} wide><ErrorState error={detail.error} copy={copy} onRetry={() => void detail.refetch()} /></StaffWorkspaceShell>;

  const labels = copy.checklist as Record<string, string>;
  const evidenceItems = d.checklist.items.map((i) => ({ key: i.key, label: labels[i.key] ?? i.key }));
  const picked = sub === "current" ? d.report : d.submissions.find((s) => String(s.no) === sub)?.report ?? null;
  const lastSub = d.submissions[d.submissions.length - 1];
  const measured = d.verification?.verifiedPercent ?? lastSub?.report.measuredProgress ?? d.report?.measuredProgress ?? null;
  const claimed = d.verification?.claimedPercent ?? d.claimedProgressAtSchedule ?? null;
  const diff = discrepancy(measured, claimed);
  const events = [
    { at: d.completedAt && d.status === "CANCELLED" ? d.completedAt : null, text: fill(copy.workspace.event.cancelled, { reason: d.cancelReason ?? "" }) },
    ...d.assignmentHistory.map((a, i) => ({ at: a.assignedAt, text: i === 0 ? fill(copy.workspace.event.assigned, { who: a.inspectorName ?? "" }) : fill(copy.workspace.event.reassigned, { who: a.inspectorName ?? "", reason: a.reason ?? "" }) })),
    ...d.rescheduleHistory.map((r) => ({ at: r.at, text: fill(copy.workspace.event.rescheduled, { from: fmtDateTime(r.from, locale), to: fmtDateTime(r.to, locale), reason: r.reason }) })),
    ...(d.startedAt ? [{ at: d.startedAt, text: copy.workspace.event.started }] : []),
    ...d.submissions.flatMap((s) => [{ at: s.submittedAt, text: fill(copy.workspace.event.submitted, { n: s.no, who: s.submittedByName ?? "" }) }, ...(s.decision ? [{ at: s.decision.at, text: `${fill(s.decision.decision === "APPROVED" ? copy.workspace.event.approved : s.decision.decision === "REJECTED" ? copy.workspace.event.rejected : copy.workspace.event.revision, { who: s.decision.byName ?? "" })}${s.decision.note ? `: ${s.decision.note}` : ""}` }] : [])]),
  ].filter((e): e is { at: string; text: string } => Boolean(e.at)).sort((a, b) => a.at.localeCompare(b.at));

  const crumbs = [{ label: copy.nav.title, href: "/inspections" }, { label: d.inspectionNo ?? d.id }];
  const scheduleInitial = { projectId: d.project?.id, type: "FOLLOW_UP" as const, followUpOfId: d.id };

  return (
    <StaffWorkspaceShell title={`${copy.workspace.title} ${d.inspectionNo ?? ""}`} description={`${d.project?.projectCode ?? ""} ${d.project?.title ?? ""}`} wide context={<ContextBar crumbs={crumbs} />}>
      <div className="ins">
        <section className="ins-panel ins-hero">
          <div className="ins-bar"><div className="ctr-row"><StatusBadge status={d.status} overdue={d.overdue} copy={copy} /><PriorityChip priority={d.priority} copy={copy} /><span className="ins-badge">{copy.type[d.inspectionType]}</span></div></div>
          <InspectionStepper status={d.status} copy={copy} />
          <dl className="ins-facts">
            <div><dt>{copy.workspace.project}</dt><dd>{d.project ? <Link className="ins-link" href={`/projects/${d.project.id}/overview`}>{d.project.projectCode} · {d.project.title}</Link> : "—"}</dd></div>
            <div><dt>{copy.workspace.when}</dt><dd>{fmtDate(d.inspectionDate, locale)} {fmtTime(d.inspectionDate, locale)} · {d.durationMinutes} {copy.common.minutesShort}</dd></div>
            <div><dt>{copy.workspace.inspector}</dt><dd>{d.inspector.name ?? "—"}</dd></div>
          </dl>
          {d.followUpOfId ? <Link className="ins-link" href={`/inspections/${d.followUpOfId}`}>{fill(copy.workspace.followUpOf, { no: d.followUpOfId.slice(-6) })}</Link> : null}
          <div className="ctr-row" aria-label={copy.workspace.actions}>
            {d.can.start ? <button type="button" className="ctr-btn is-primary" disabled={start.isPending} onClick={() => start.mutate()}>{copy.workspace.startNow}</button> : null}
            {d.can.editReport ? <Link className="ctr-btn is-primary" href={`/inspections/${d.id}/report`}>{copy.workspace.continueReport}</Link> : null}
            {reviewer ? <button type="button" className="ctr-btn is-primary" onClick={() => setTab("review")}>{copy.workspace.reviewNow}</button> : null}
            {d.can.reschedule ? <button type="button" className="ctr-btn" onClick={() => setDialog("reschedule")}>{copy.overview.reschedule}</button> : null}
            {d.can.reassign ? <button type="button" className="ctr-btn" onClick={() => setDialog("reassign")}>{copy.overview.reassign}</button> : null}
            {d.can.cancel ? <button type="button" className="ctr-btn" onClick={() => setDialog("cancel")}>{copy.overview.cancel}</button> : null}
            {d.can.followUp ? <button type="button" className="ctr-btn" onClick={() => setDialog("follow")}>{copy.workspace.scheduleFollowUp}</button> : null}
          </div>
          {d.status === "CANCELLED" || d.status === "VERIFIED" || d.status === "REJECTED" ? <p className="ins-muted">{copy.workspace.locked}</p> : null}
        </section>

        <div className="ins-scroll-tabs" role="tablist" aria-label={copy.workspace.title}>
          {tabs.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === "review" ? copy.review.title : copy.workspace.tabs[t]}</button>)}
        </div>

        {tab === "overview" ? (
          <section className="ins-panel"><dl className="ins-facts">
            <div><dt>{copy.workspace.purpose}</dt><dd>{d.purpose ?? copy.common.notProvided}</dd></div>
            <div><dt>{copy.workspace.location}</dt><dd>{d.locationNote ?? copy.common.notProvided}</dd></div>
            <div><dt>{copy.workspace.scheduledBy}</dt><dd>{d.scheduledByName ?? "—"}</dd></div>
            <div><dt>{copy.workspace.claimed}</dt><dd>{claimed === null ? copy.common.notProvided : `${claimed}%`}</dd></div>
            <div><dt>{copy.workspace.measured}</dt><dd>{measured === null ? copy.common.notProvided : `${measured}%`}</dd></div>
            <div><dt>{copy.workspace.milestones}</dt><dd>{d.milestoneIds.length ? d.milestoneIds.map((m) => milestones.data?.milestones.find((x) => x.id === m)?.title ?? m).join(", ") : copy.common.none}</dd></div>
            <div><dt>{copy.workspace.contractors}</dt><dd>{d.contractors.length ? d.contractors.map((c) => c.name).join(", ") : copy.workspace.noContractors}</dd></div>
          </dl></section>
        ) : null}

        {tab === "report" ? (
          <div className="ins">
            {d.submissions.length ? <Field label={copy.workspace.submissionPicker}>{(fid) => <select id={fid} className="ctr-input" value={sub} onChange={(e) => setSub(e.target.value)}>{d.report && d.can.editReport ? <option value="current">{copy.workspace.currentDraft}</option> : null}{d.submissions.map((s) => <option key={s.no} value={String(s.no)}>#{s.no} · {fmtDateTime(s.submittedAt, locale)}</option>)}</select>}</Field> : null}
            {(sub === "current" && !d.can.editReport && d.submissions.length ? d.submissions[d.submissions.length - 1]!.report : picked) ? <ReportView report={(sub === "current" && !d.can.editReport && d.submissions.length ? d.submissions[d.submissions.length - 1]!.report : picked)!} d={d} copy={copy} /> : <p className="ins-muted">{copy.workspace.noReport}</p>}
            {d.submissions.map((s) => s.decision ? <div key={s.no} className="ins-note"><strong>#{s.no} · {s.decision.decision === "APPROVED" ? copy.workspace.event.approved.replace("{who}", s.decision.byName ?? "") : s.decision.decision === "REJECTED" ? copy.workspace.event.rejected.replace("{who}", s.decision.byName ?? "") : copy.workspace.event.revision.replace("{who}", s.decision.byName ?? "")}</strong>{s.decision.note ? <p>{s.decision.note}</p> : null}{s.decision.itemComments.map((c) => <p key={c.itemKey}><em>{labels[c.itemKey] ?? c.itemKey}:</em> {c.comment}</p>)}</div> : null)}
          </div>
        ) : null}

        {tab === "evidence" ? <EvidencePanel inspectionId={d.id} evidence={d.evidence} editable={false} copy={copy} locale={locale} items={evidenceItems} defects={(d.report?.defects ?? lastSub?.report.defects ?? []).map((x) => ({ key: x.key, title: x.title }))} onChanged={() => void qc.invalidateQueries({ queryKey: key("detail", id) })} /> : null}

        {(tab === "verification" || tab === "review") ? (
          <section className="ins-panel ins-compare" aria-label={copy.review.compare}>
            <h3 className="ins-h">{copy.review.compare}</h3>
            <DualGauge claimed={claimed} verified={measured} copy={copy} />
            <div className="ctr-row">
              {diff !== null ? <span className="ins-prio" data-p={Math.abs(diff) > DISCREPANCY_THRESHOLD_PP ? "HIGH" : "NORMAL"}>{copy.review.gap}: {ppText(diff, copy)}</span> : null}
              {d.verification ? <span className="ins-badge" data-t="site-on">{copy.status.VERIFIED} · {fmtDate(d.verification.asOf, locale)}</span> : <span className="ins-badge">{copy.project.notVerified}</span>}
            </div>
            {tab === "review" && diff !== null && Math.abs(diff) > DISCREPANCY_THRESHOLD_PP ? <p className="ins-warn ins-bad" role="alert"><AlertTriangleIcon aria-hidden="true" /><span><strong>{copy.review.discrepancyPanel}</strong> · {fill(copy.review.discrepancyBody, { pp: Math.abs(diff) })}</span></p> : null}
            {(d.verification?.milestones.length ?? lastSub?.report.milestoneAssessments.length ?? 0) ? (
              <table className="ins-table"><caption className="ins-h" style={{ textAlign: "left" }}>{copy.review.milestoneTable}</caption><thead><tr><th scope="col">{copy.review.milestone}</th><th scope="col">{copy.review.reportedCol}</th><th scope="col">{copy.review.assessedCol}</th></tr></thead>
                <tbody>{(d.verification?.milestones ?? (lastSub?.report.milestoneAssessments ?? []).map((m) => ({ milestoneId: m.milestoneId, claimedProgress: milestones.data?.milestones.find((x) => x.id === m.milestoneId)?.progress, verifiedProgress: m.verifiedProgress }))).map((m) => <tr key={m.milestoneId}><td>{milestones.data?.milestones.find((x) => x.id === m.milestoneId)?.title ?? m.milestoneId}</td><td>{m.claimedProgress ?? "—"}%</td><td>{m.verifiedProgress}%</td></tr>)}</tbody></table>
            ) : null}
            <div><strong>{copy.review.history}</strong>
              {series.data ? <Sparkline copy={copy} reported={series.data.reported.filter((r) => r.at).map((r) => ({ t: new Date(r.at!).getTime(), v: r.percent }))} verified={series.data.verified.filter((v) => v.asOf).map((v) => ({ t: new Date(v.asOf!).getTime(), v: v.percent }))} /> : <p className="ins-muted">{copy.common.loading}</p>}
              <p className="ins-muted">{copy.project.basis}</p></div>
            {d.contractors.length ? <p className="ins-muted">{copy.review.contractorsAtInspection}: {d.contractors.map((c) => c.name).join(", ")}</p> : null}
          </section>
        ) : null}

        {tab === "review" ? (
          <>
            {lastSub ? <ReportView report={lastSub.report} d={d} copy={copy} /> : null}
            <section className="ins-panel"><h3 className="ins-h">{copy.review.photos}</h3><EvidencePanel inspectionId={d.id} evidence={d.evidence} editable={false} copy={copy} locale={locale} items={evidenceItems} defects={(lastSub?.report.defects ?? []).map((x) => ({ key: x.key, title: x.title }))} onChanged={() => undefined} /></section>
            {d.submissions.length > 1 ? <section className="ins-panel"><h3 className="ins-h">{copy.review.previous}</h3>{d.submissions.slice(0, -1).map((s) => <p key={s.no} className="ins-muted">#{s.no} · {fmtDateTime(s.submittedAt, locale)} · {s.decision?.decision ?? "—"}{s.decision?.note ? ` · ${s.decision.note}` : ""}</p>)}</section> : null}
            <div className="ins-sticky-actions">
              {d.can.decide ? (
                <>
                  {d.can.approve ? <button type="button" className="ctr-btn is-primary" onClick={() => setDecision("APPROVE")}>{copy.review.approve}</button> : null}
                  <button type="button" className="ctr-btn" onClick={() => setDecision("REQUEST_REVISION")}>{copy.review.requestRevision}</button>
                  {d.can.reject ? <button type="button" className="ctr-btn is-danger" onClick={() => setDecision("REJECT")}>{copy.review.reject}</button> : null}
                </>
              ) : <p className="ins-warn" role="status"><AlertTriangleIcon aria-hidden="true" />{d.can.decideBlockedReason === "own_submission" ? copy.review.blockedOwn : copy.common.forbiddenBody}</p>}
            </div>
          </>
        ) : null}

        {tab === "history" ? (
          <section className="ins-panel"><h3 className="ins-h">{copy.workspace.history}</h3><ol className="ins-timeline">{events.map((e, i) => <li key={i}><span className="ins-muted">{fmtDateTime(e.at, locale)}</span><br />{e.text}</li>)}</ol></section>
        ) : null}
      </div>

      <RescheduleDialog row={dialog === "reschedule" ? row : null} onClose={() => setDialog(null)} copy={copy} locale={locale} />
      <ReassignDialog row={dialog === "reassign" ? row : null} onClose={() => setDialog(null)} copy={copy} locale={locale} />
      <CancelDialog row={dialog === "cancel" ? row : null} onClose={() => setDialog(null)} copy={copy} />
      <ScheduleDialog open={dialog === "follow"} onOpenChange={(o) => { if (!o) setDialog(null); }} copy={copy} locale={locale} initial={scheduleInitial} />
      <DecisionDialog mode={decision} d={d} onClose={() => setDecision(null)} copy={copy} locale={locale} />
    </StaffWorkspaceShell>
  );
}
