"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowLeftIcon, CheckCircle2Icon, CircleAlertIcon, InfoIcon, PencilIcon, RefreshCwIcon, SendIcon, Trash2Icon, XCircleIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { StatusChip } from "@/components/site-plan/site-plan";
import { RouteLines } from "@/components/motif/connected-motif";
import { cancelWorkRequest, classifyWorkRequestError, deleteWorkRequest, fetchWorkRequest, submitWorkRequest, updateWorkRequest, FAILURE_COPY } from "@/lib/roadsync/api";
import {
  buildPatchBody,
  canHintCreate,
  EMPTY_FORM,
  formatColombo,
  formatPosition,
  summarizeGeometry,
  valuesFromRecord,
  WORK_TYPE_LABELS,
  workRequestQueryKey,
  type WorkRequestFormErrors,
  type WorkRequestFormValues,
  type WorkRequestRecord,
} from "@/lib/roadsync/work-requests-view";
import { getWorkRequestCopy } from "@/lib/roadsync/work-request-copy";
import type { NearbyOverlay } from "@/lib/roadsync/nearby";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { ConflictsPanel, useAssessment } from "./conflicts-panel";
import { NearbyActivityPanel } from "./nearby-activity";
import { RequestAdvisorCard } from "./request-advisor-card";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { getCoordCopy } from "@/lib/roadsync/coordination-copy";
import { fmt } from "@/lib/roadsync/assessment";
import { RiskChip } from "./risk-visuals";
import { PriorityMark, WorkTypeIcon } from "./roadsync-shared";
import { WorkMap } from "./work-map";
import { ConfirmDialog } from "./work-request-dialogs";
import { failureText } from "./work-request-new-client";
import { WorkRequestWizard } from "./work-request-wizard";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function WorkRequestDetailClient({ id }: { id: string }) {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [nearbyOverlay, setNearbyOverlay] = useState<NearbyOverlay | null>(null);
  const [conflictOverlay, setConflictOverlay] = useState<NearbyOverlay | null>(null);
  const [layer, setLayer] = useState<"conflicts" | "nearby">("conflicts");
  const [locale] = useWorkspaceLocale();
  const risk = getAssessmentCopy(locale);
  const cc = getConflictCopy(locale);
  const params = useSearchParams();
  const created = params.get("created") === "1";
  const justSubmitted = params.get("submitted") === "1";
  const submitFailed = params.get("submitFailed");
  const wc = getWorkRequestCopy(locale);
  const router = useRouter();
  const queryClient = useQueryClient();
  const detailKey = workRequestQueryKey(epoch, userId, roleKey, "detail", id);
  const query = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchWorkRequest(id),
    enabled: Boolean(userId),
    retry: false,
    // After a submit the server scans in the background: poll its real state, never assume a result.
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "DRAFT" && ["pending", "running"].includes(q.state.data.detection?.status ?? "pending") ? 3000 : false),
  });
  const wr = query.data;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<WorkRequestFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<WorkRequestFormErrors>({});
  const [dialog, setDialog] = useState<null | "submit" | "cancel" | "delete">(null);
  const [pending, setPending] = useState<false | "save" | "submit" | "cancel" | "delete">(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ stale: boolean; text: string } | null>(null);
  const canManage = canHintCreate(roleKey);

  const accept = (record: WorkRequestRecord, message: string) => {
    queryClient.setQueryData(detailKey, record);
    void queryClient.invalidateQueries({ queryKey: ["roadsync", "work-requests"] });
    setNotice(message);
    setProblem(null);
  };
  /** A 409 means the request changed (or left the draft state) since it was loaded: never overwrite, offer a reload. */
  const failed = (error: unknown) => {
    const kind = classifyWorkRequestError(error);
    setProblem(kind === "conflict" ? { stale: true, text: wc.states.staleBody } : { stale: false, text: failureText(wc, kind) });
  };
  async function reload() {
    setProblem(null);
    setEditing(false);
    await query.refetch();
  }
  function startEdit() {
    if (!wr) return;
    setValues(valuesFromRecord(wr));
    setErrors({});
    setNotice(null);
    setProblem(null);
    setEditing(true);
  }
  async function saveChanges() {
    if (!wr || pending) return;
    const built = buildPatchBody(values, wr.revision);
    if (!built.ok) { setErrors(built.errors); return; }
    setPending("save");
    try {
      accept(await updateWorkRequest(wr.id, built.body), wc.states.saved);
      setEditing(false);
    } catch (error) { failed(error); } finally { setPending(false); }
  }
  async function doSubmit() {
    if (!wr || pending) return;
    setPending("submit");
    try {
      const done = await submitWorkRequest(wr.id, wr.revision);
      accept(done, `${wc.states.submitted} ${fmt(wc.states.submittedRef, { ref: done.referenceNo ?? "—" })}`);
      setDialog(null);
    } catch (error) { setDialog(null); failed(error); } finally { setPending(false); }
  }
  async function doCancel(reason: string) {
    if (!wr || pending) return;
    setPending("cancel");
    try {
      accept(await cancelWorkRequest(wr.id, { version: wr.revision, reason }), wc.states.cancelled);
      setDialog(null);
    } catch (error) { setDialog(null); failed(error); } finally { setPending(false); }
  }
  async function doDelete() {
    if (!wr || pending) return;
    setPending("delete");
    try {
      await deleteWorkRequest(wr.id);
      void queryClient.invalidateQueries({ queryKey: ["roadsync", "work-requests"] });
      router.push("/roadsync/work-requests");
    } catch (error) { setDialog(null); failed(error); setPending(false); }
  }
  const assessment = useAssessment(id, Boolean(wr && wr.status !== "DRAFT"));
  const assessed = assessment.query.data;
  const severity = new Map((assessed?.items ?? []).map((i) => [i.candidateId, { kind: i.assessment.kind, band: i.assessment.effective.band }] as const));
  const overlay = layer === "nearby" ? nearbyOverlay ?? conflictOverlay : conflictOverlay ?? nearbyOverlay;
  const failure = query.error ? classifyWorkRequestError(query.error) : null;
  const geo = wr ? summarizeGeometry(wr.geometry) : null;
  const vertices = wr ? (wr.geometry.type === "Point" ? [wr.geometry.coordinates] : wr.geometry.type === "LineString" ? wr.geometry.coordinates : (wr.geometry.coordinates[0] ?? [])) : [];

  return (
    <StaffWorkspaceShell title={wr ? WORK_TYPE_LABELS[wr.workType] : "Work request"} description={wr && wr.status !== "DRAFT" ? wc.states.readOnlyNote : undefined} wide>
      <div className="rs-page">
        <div className="rs-eyebrow">
          <p className="rs-crumb">Operations / RoadSync / Work request</p>
          <Link href="/roadsync/work-requests" className="rs-btn">
            <ArrowLeftIcon aria-hidden="true" />
            All work requests
          </Link>
        </div>

        {query.isPending ? (
          <div className="rs-list" role="status" aria-label="Loading work request">
            <div className="rs-skel-row" /><div className="rs-skel-row" /><div className="rs-skel-row" />
          </div>
        ) : failure ? (
          <div className="rs-state" role="alert">
            <RouteLines className="rs-state-motif" />
            <h2>{failure === "not-found" ? "Work request not found" : "Work request could not be loaded"}</h2>
            <p>{failure === "not-found" ? "It does not exist, or it is outside your authorised scope." : FAILURE_COPY[failure]}</p>
            <Link href="/roadsync/work-requests" className="rs-btn">Back to work requests</Link>
          </div>
        ) : wr && geo ? (
          <>
            {notice || (created && !submitFailed) || justSubmitted ? (
              <div className="mc-alert" role="status" style={{ background: "var(--status-success-bg)", borderColor: "var(--status-success-border)", color: "var(--status-success-fg)" }}>
                <CheckCircle2Icon aria-hidden="true" />
                <p>{notice ?? (justSubmitted ? `${wc.states.submitted} ${fmt(wc.states.submittedRef, { ref: wr.referenceNo ?? "—" })}` : wc.states.created)}</p>
              </div>
            ) : null}
            {submitFailed && !notice ? (
              <div className="mc-alert" role="alert">
                <CircleAlertIcon aria-hidden="true" />
                <p>{fmt(wc.states.partial, { reason: submitFailed })}</p>
              </div>
            ) : null}
            {problem ? (
              <div className="rs-errsum" role="alert">
                <h2>{problem.stale ? wc.states.stale : wc.create.errSummaryServer}</h2>
                <p style={{ margin: 0 }}>{problem.text}</p>
                {problem.stale ? <button type="button" className="rs-btn is-primary" onClick={() => void reload()}><RefreshCwIcon aria-hidden="true" />{wc.states.refresh}</button> : null}
              </div>
            ) : null}
            <section className="rs-hero" aria-label="Work request summary">
              <div className="rs-hero-top">
                <WorkTypeIcon type={wr.workType} />
                <h2>{WORK_TYPE_LABELS[wr.workType]}</h2>
                <StatusChip domain="work" status={wr.status} />
                <PriorityMark priority={wr.priority} />
                {wr.status !== "DRAFT" ? (
                  <span className="rs-nb-chip" role="status">
                    {wr.detection?.status === "running" ? wc.states.scanRunning : wr.detection?.status === "failed" ? wc.states.scanFailed : wr.detection?.status === "completed" ? wc.states.scanDone : wr.detection?.status === "pending" ? wc.states.scanPending : wc.states.notScanned}
                    {wr.nearbyCount > 0 ? ` · ${wr.nearbyCount} nearby` : ""}
                  </span>
                ) : null}
                {wr.status !== "DRAFT" && assessed?.summary.status === "completed" ? <a href="#conflicts" className="rs-listrisk" aria-label={`${risk.riskIndex}: ${assessed.summary.riskIndex}`}><RiskChip value={assessed.summary.riskIndex} band={assessed.summary.maxBand} copy={risk} /></a> : null}
                {wr.status !== "DRAFT" && wr.conflictRecords && wr.conflictRecords.total > 0 ? <Link href={`/roadsync/conflicts?requestId=${wr.id}`} className="rs-nb-chip">{wr.conflictRecords.needsAck > 0 ? fmt(cc.integrations.heroChip, { total: wr.conflictRecords.total, needs: wr.conflictRecords.needsAck }) : fmt(cc.integrations.heroChipNone, { total: wr.conflictRecords.total })}</Link> : null}
                {wr.status !== "DRAFT" && wr.coordination && wr.coordination.active > 0 ? <Link href="/roadsync/coordination?preset=all" className="rs-nb-chip">{getCoordCopy(locale).integrations.coordination}{wr.coordination.needsMyResponse > 0 ? ` · ${getCoordCopy(locale).integrations.needsResponse}` : ""}</Link> : null}
              </div>
              <dl className="rs-facts">
                <div><dt>Project</dt><dd>{wr.projectTitle ?? "—"}{wr.projectCode ? ` (${wr.projectCode})` : ""}</dd></div>
                <div><dt>Agency</dt><dd>{wr.agencyName ?? "—"}</dd></div>
                <div><dt>Planned start</dt><dd>{formatColombo(wr.plannedStart)}</dd></div>
                <div><dt>Planned end</dt><dd>{formatColombo(wr.plannedEnd)}</dd></div>
                <div><dt>Created</dt><dd>{formatColombo(wr.createdAt)}</dd></div>
                <div><dt>{wc.states.reference}</dt><dd style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "0.8rem" }}>{wr.referenceNo ?? "—"}</dd></div>
                <div><dt>{wc.states.hours}</dt><dd>{wc.hours[wr.workingHours ?? "day"][0]}</dd></div>
                <div><dt>{wc.states.emergency}</dt><dd>{wr.isEmergency ? wc.states.yes : wc.states.no}</dd></div>
              </dl>
              {canManage && !editing ? (
                <div className="rs-actions rs-hero-actions">
                  {wr.status === "DRAFT" ? (
                    <>
                      <button type="button" className="rs-btn" onClick={startEdit} disabled={Boolean(pending)}><PencilIcon aria-hidden="true" />{wc.actions.edit}</button>
                      <button type="button" className="rs-btn is-primary" onClick={() => setDialog("submit")} disabled={Boolean(pending)}><SendIcon aria-hidden="true" />{wc.actions.submitNow}</button>
                      <button type="button" className="rs-btn is-danger-quiet" onClick={() => setDialog("delete")} disabled={Boolean(pending)}><Trash2Icon aria-hidden="true" />{wc.actions.deleteDraft}</button>
                    </>
                  ) : ["SUBMITTED", "PLANNED", "APPROVED", "ACTIVE"].includes(wr.status) ? (
                    <button type="button" className="rs-btn is-danger-quiet" onClick={() => setDialog("cancel")} disabled={Boolean(pending)}><XCircleIcon aria-hidden="true" />{wc.actions.cancelRequest}</button>
                  ) : null}
                </div>
              ) : null}
            </section>

            {editing ? (
              <WorkRequestWizard mode="edit" copy={wc} values={values} setValues={setValues} errors={errors} setErrors={setErrors} projects={{ options: [], pending: false, error: false }} lockedProject={`${wr.projectCode ?? ""} · ${wr.projectTitle ?? ""}`} pending={pending === "save" ? "save" : false} onSave={() => void saveChanges()} onDiscard={() => { setEditing(false); setErrors({}); }} />
            ) : null}

            {wr.status === "DRAFT" && !editing ? <div className="rs-notice" role="note">
              <InfoIcon aria-hidden="true" style={{ width: "1.1rem", height: "1.1rem", flex: "none", marginTop: "0.1rem" }} />
              <p style={{ margin: 0 }}>
                {wc.states.draftNotice} {wc.schedule.tz}.
              </p>
            </div> : null}

            {!editing ? <div className="rs-detail-grid">
              <section className="rs-section" aria-labelledby="rs-geo">
                <h2 id="rs-geo">Location</h2>
                {nearbyOverlay && conflictOverlay ? (
                  <div className="rs-cseg" role="group" aria-label="Map layer">
                    <button type="button" className="rs-btn" aria-pressed={layer === "conflicts"} onClick={() => setLayer("conflicts")}>{risk.tab}</button>
                    <button type="button" className="rs-btn" aria-pressed={layer === "nearby"} onClick={() => setLayer("nearby")}>Nearby</button>
                  </div>
                ) : null}
                <WorkMap features={[{ geometry: wr.geometry }]} height={300} label="Work request location map" overlay={overlay} />
                <p className="rs-help">
                  {geo.label} · {geo.vertices} {geo.vertices === 1 ? "vertex" : "vertices"}
                  {geo.lengthKm !== null ? ` · about ${geo.lengthKm.toFixed(2)} km` : ""}.
                </p>
              </section>
              <section className="rs-section" aria-labelledby="rs-coords">
                <h2 id="rs-coords">Coordinates</h2>
                <ol className="rs-coords" aria-label="Vertex list">
                  {vertices.slice(0, 200).map((p, i) => (
                    <li key={i}>{i + 1}. {formatPosition(p)}</li>
                  ))}
                </ol>
                {vertices.length > 200 ? <p className="rs-help">Showing the first 200 of {vertices.length} vertices.</p> : null}
              </section>
            </div> : null}
            {wr.status !== "DRAFT" ? (
              <>
                <div className="rs-section" id="conflicts">
                  <ConflictsPanel requestId={wr.id} self={{ workType: wr.workType, plannedStart: wr.plannedStart, plannedEnd: wr.plannedEnd, geometry: wr.geometry }} canRun={canHintCreate(roleKey)} national={roleKey === "SUPER_ADMIN"} onOverlay={setConflictOverlay} />
                  {wr.conflictRecords && wr.conflictRecords.total > 0 ? <RequestAdvisorCard requestId={wr.id} /> : null}
                </div>
                <div className="rs-section" id="nearby">
                  <NearbyActivityPanel mode="persisted" requestId={wr.id} self={{ workType: wr.workType, plannedStart: wr.plannedStart, plannedEnd: wr.plannedEnd, geometry: wr.geometry }} canRun={canHintCreate(roleKey)} onOverlay={setNearbyOverlay} severity={severity} />
                </div>
              </>
            ) : null}
            {dialog === "submit" ? <ConfirmDialog title={wc.dialogs.submitTitle} body={wc.dialogs.submitBody} confirmLabel={wc.dialogs.confirmSubmit} keepLabel={wc.dialogs.keep} pending={pending === "submit"} onConfirm={() => void doSubmit()} onClose={() => setDialog(null)} /> : null}
            {dialog === "cancel" ? <ConfirmDialog title={wc.dialogs.cancelTitle} body={wc.dialogs.cancelBody} confirmLabel={wc.dialogs.confirmCancel} keepLabel={wc.dialogs.keep} tone="danger" pending={pending === "cancel"} reason={{ label: wc.dialogs.reason, help: wc.dialogs.reasonHelp, min: 10 }} onConfirm={(r) => void doCancel(r)} onClose={() => setDialog(null)} /> : null}
            {dialog === "delete" ? <ConfirmDialog title={wc.dialogs.deleteTitle} body={wc.dialogs.deleteBody} confirmLabel={wc.dialogs.confirmDelete} keepLabel={wc.dialogs.keep} tone="danger" pending={pending === "delete"} onConfirm={() => void doDelete()} onClose={() => setDialog(null)} /> : null}
          </>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}
