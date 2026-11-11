"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CloudOffIcon, LoaderIcon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { failureOf, fetchInspection, saveReport, startInspection, submitInspection } from "@/lib/inspections/api";
import { getInspectionAiCopy } from "@/lib/inspections/ai/messages";
import { AUTOSAVE_DEBOUNCE_MS, afterFailure, clearMirror, readMirror, shouldOfferRecovery, writeMirror, type SaveState } from "@/lib/inspections/autosave";
import { getInspectionCopy, type Copy } from "@/lib/inspections/messages";
import { useInspectionKeys } from "@/lib/inspections/session";
import { DEFECT_SEVERITIES, DISCREPANCY_THRESHOLD_PP, type ChecklistResult, type Defect, type InspectionDetail, type Report } from "@/lib/inspections/types";
import { clientGaps, discrepancy, emptyReport, fill, GAP_STEP, isProgressType, newDefectKey, overThreshold, sameReport, type Gap, type GapStep } from "@/lib/inspections/view";
import { fetchMilestones } from "@/lib/projects/milestones-api";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { AiEvidenceCheck } from "./ai/ai-evidence-check";
import { EvidencePanel } from "./evidence-panel";
import { EmptyState, ErrorState, Field, Skeletons, errorText } from "./inspection-ui";

const STEPS = ["overview", "checklist", "observations", "defects", "evidence", "progress", "submit"] as const;
type Step = (typeof STEPS)[number];

const toPayload = (r: Report): Omit<Report, "checklistVersion"> => {
  const { checklistVersion: _v, measuredProgress, ...rest } = r;
  void _v;
  return { ...rest, ...(measuredProgress !== undefined ? { measuredProgress } : {}) } as Omit<Report, "checklistVersion">;
};

function SaveIndicator({ state, savedAt, copy, onRetry }: { state: SaveState; savedAt: string; copy: Copy; onRetry: () => void }) {
  const text = state === "saved" ? fill(copy.report.saveState.saved, { time: savedAt }) : copy.report.saveState[state];
  const Icon = state === "saving" || state === "retrying" ? LoaderIcon : state === "failed" || state === "conflict" ? CloudOffIcon : CheckIcon;
  return (
    <span className="ins-save" data-state={state} role="status" aria-live="polite"><Icon aria-hidden="true" />{text}{state === "failed" ? <button type="button" className="ctr-btn is-ghost" onClick={onRetry}>{copy.report.retrySave}</button> : null}</span>
  );
}

function Counter({ value, max, copy }: { value: string | undefined; max: number; copy: Copy }) {
  return <p className="ins-counter" aria-hidden="true">{fill(copy.report.characters, { n: (value ?? "").length, max })}</p>;
}

export function ReportEditor({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const router = useRouter();
  const qc = useQueryClient();
  const { key } = useInspectionKeys();
  const detail = useQuery({ queryKey: key("detail", id), queryFn: ({ signal }) => fetchInspection(id, signal), refetchOnWindowFocus: false });
  const d = detail.data;

  const [report, setReport] = useState<Report | null>(null);
  const [step, setStep] = useState<Step>("overview");
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState("");
  const [recovery, setRecovery] = useState<Report | null>(null);
  const [conflict, setConflict] = useState<{ revision: number | null } | null>(null);
  const [online, setOnline] = useState(true);
  const [serverGaps, setServerGaps] = useState<Gap[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const revision = useRef(0);
  const dirty = useRef(false);
  const saving = useRef(false);
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportRef = useRef<Report | null>(null);
  const initialised = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => { reportRef.current = report; }, [report]);
  useEffect(() => { const up = () => setOnline(true); const down = () => setOnline(false); queueMicrotask(() => setOnline(navigator.onLine)); window.addEventListener("online", up); window.addEventListener("offline", down); return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); }; }, []);

  // First load: take the server copy, then offer the local mirror only if it is newer and different.
  useEffect(() => {
    if (!d || initialised.current) return;
    const server = d.report ?? emptyReport();
    const template = d.checklist.items;
    const filled: Report = { ...server, checklist: template.map((t) => server.checklist.find((c) => c.key === t.key) ?? { key: t.key, result: "NOT_CHECKED" as ChecklistResult }) };
    revision.current = server.revision;
    initialised.current = true;
    queueMicrotask(() => {
      setReport(filled);
      const mirror = readMirror<Report>(localStorage, id);
      if (mirror && shouldOfferRecovery(mirror, server.revision, !sameReport(mirror.draft, filled))) setRecovery(mirror.draft);
      else if (mirror) clearMirror(localStorage, id);
    });
  }, [d, id]);

  const flush = async (): Promise<void> => {
    const current = reportRef.current;
    if (!current || saving.current || !dirty.current) return;
    saving.current = true; dirty.current = false;
    setState(attempts.current > 0 ? "retrying" : "saving");
    try {
      const res = await saveReport(id, { ...toPayload(current), revision: revision.current });
      revision.current = res.revision; attempts.current = 0;
      const t = new Date(res.savedAt);
      setSavedAt(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
      saving.current = false;
      if (dirty.current) { setState("dirty"); timer.current = setTimeout(() => void flushRef.current(), AUTOSAVE_DEBOUNCE_MS); } else { setState("saved"); clearMirror(localStorage, id); }
    } catch (e) {
      saving.current = false; dirty.current = true;
      attempts.current += 1;
      const f = failureOf(e);
      const next = afterFailure(f.status, attempts.current);
      setState(next.state);
      if (next.state === "conflict") setConflict({ revision: typeof f.details.revision === "number" ? f.details.revision : null });
      if (next.retryInMs !== null) timer.current = setTimeout(() => void flushRef.current(), next.retryInMs);
    }
  };
  useEffect(() => { flushRef.current = flush; });

  const change = (fn: (r: Report) => Report) => {
    setReport((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      reportRef.current = next;
      dirty.current = true;
      writeMirror(localStorage, id, revision.current, next);
      if (timer.current) clearTimeout(timer.current);
      if (!saving.current) { setState("dirty"); timer.current = setTimeout(() => void flushRef.current(), AUTOSAVE_DEBOUNCE_MS); }
      return next;
    });
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty.current || saving.current) e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, []);

  const milestones = useQuery({ queryKey: key("milestones", d?.project?.id), queryFn: () => fetchMilestones(d!.project!.id), enabled: Boolean(d?.project) && Boolean(d?.milestoneIds.length) });
  const refetchDetail = () => void qc.invalidateQueries({ queryKey: key("detail", id) });
  const start = useMutation({ mutationFn: () => startInspection(id), onSuccess: () => { toast.success(copy.dialogs.started); initialised.current = false; refetchDetail(); }, onError: (e) => setError(errorText(e, copy)) });

  const labels = copy.checklist as Record<string, string>;
  const template = useMemo(() => d?.checklist.items ?? [], [d]);
  const type = d?.inspectionType ?? "PROGRESS_VERIFICATION";
  const progress = isProgressType(type);
  const claimed = d?.claimedProgressAtSchedule ?? null;
  const gaps = useMemo(() => (d && report ? clientGaps({ type, template, report, evidence: d.evidence, claimed }) : []), [d, report, type, template, claimed]);
  const shownGaps = [...new Set([...gaps, ...serverGaps])];
  const usedSteps = STEPS.filter((s) => s !== "progress" || progress);
  const idx = usedSteps.indexOf(step);

  const submit = useMutation({
    mutationFn: async () => {
      if (timer.current) clearTimeout(timer.current);
      dirty.current = true; saving.current = false;
      await flushRef.current();
      if (dirty.current) throw Object.assign(new Error("save"), { handled: true });
      return submitInspection(id, revision.current);
    },
    onSuccess: () => { toast.success(copy.report.submitted); clearMirror(localStorage, id); void qc.invalidateQueries({ queryKey: ["inspections"] }); router.push(`/inspections/${id}`); },
    onError: (e) => { if ((e as { handled?: boolean }).handled) { setError(copy.report.saveState.failed); return; } const f = failureOf(e); setServerGaps(f.gaps as Gap[]); setError(f.gaps.length ? copy.report.missingTitle : errorText(e, copy)); if (f.gaps.length) setStep(GAP_STEP[f.gaps[0] as Gap] === "submit" ? "submit" : (GAP_STEP[f.gaps[0] as Gap] as Step)); },
  });

  if (detail.isPending) return <StaffWorkspaceShell title={copy.report.title} wide><Skeletons /></StaffWorkspaceShell>;
  if (detail.isError || !d) return <StaffWorkspaceShell title={copy.report.title} wide><ErrorState error={detail.error} copy={copy} onRetry={() => void detail.refetch()} /></StaffWorkspaceShell>;
  const crumbs = [{ label: copy.nav.title, href: "/inspections" }, { label: d.inspectionNo ?? d.id, href: `/inspections/${id}` }, { label: copy.report.title }];

  if (!d.can.editReport) {
    return (
      <StaffWorkspaceShell title={copy.report.title} wide context={<ContextBar crumbs={crumbs} />}>
        <EmptyState title={d.status === "SCHEDULED" ? copy.report.cannotStart : copy.report.readOnly}
          action={d.can.start ? <button type="button" className="ctr-btn is-primary" onClick={() => start.mutate()} disabled={start.isPending}>{copy.my.start}</button> : <Link className="ctr-btn" href={`/inspections/${id}`}>{copy.common.back}</Link>} />
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
      </StaffWorkspaceShell>
    );
  }
  if (!report) return <StaffWorkspaceShell title={copy.report.title} wide><Skeletons /></StaffWorkspaceShell>;

  const lastDecision = [...d.submissions].reverse().find((s) => s.decision?.decision === "REVISION_REQUESTED")?.decision ?? null;
  const evidenceItems = template.map((t) => ({ key: t.key, label: labels[t.key] ?? t.key }));
  const groups = [...new Set(template.map((t) => t.group))];
  const answered = report.checklist.filter((c) => c.result !== "NOT_CHECKED").length;
  const setItem = (k: string, patch: { result?: ChecklistResult; note?: string }) => change((r) => ({ ...r, checklist: r.checklist.map((c) => (c.key === k ? { ...c, ...patch } : c)) }));
  const setDefect = (k: string, patch: Partial<Defect>) => change((r) => ({ ...r, defects: r.defects.map((x) => (x.key === k ? { ...x, ...patch } : x)) }));
  const goStep = (s: GapStep | Step) => setStep(s as Step);

  const measured = report.measuredProgress;
  const diff = discrepancy(measured, claimed);
  const big = overThreshold(measured, claimed);
  const stepLabel = (s: Step) => copy.report.steps[s];

  return (
    <StaffWorkspaceShell title={copy.report.title} description={`${d.inspectionNo ?? ""} · ${d.project?.projectCode ?? ""} ${d.project?.title ?? ""}`} wide context={<ContextBar crumbs={crumbs} />}>
      <div className="ins">
        {!online ? <p className="ins-offline" role="status"><CloudOffIcon aria-hidden="true" style={{ width: 14, height: 14, display: "inline" }} /> {copy.my.offlineBanner}</p> : null}
        {lastDecision ? (
          <div className="ins-note" role="note"><strong>{copy.report.revisionBanner}</strong><p>{lastDecision.note}</p>{lastDecision.itemComments.map((c) => <p key={c.itemKey}><em>{labels[c.itemKey] ?? c.itemKey}:</em> {c.comment}</p>)}</div>
        ) : null}
        <div className="ins-progressbar" role="progressbar" aria-valuemin={1} aria-valuemax={usedSteps.length} aria-valuenow={idx + 1} aria-label={fill(copy.report.stepOf, { n: idx + 1, total: usedSteps.length })}><i style={{ width: `${((idx + 1) / usedSteps.length) * 100}%` }} /></div>

        <div className="ins-report">
          <nav className="ins-rail" aria-label={copy.report.title}>
            {usedSteps.map((s, i) => <button key={s} type="button" aria-current={s === step ? "step" : undefined} onClick={() => setStep(s)}><span>{i + 1}. {stepLabel(s)}</span>{s === "submit" && gaps.length ? <span aria-hidden="true">{gaps.length}</span> : null}</button>)}
          </nav>
          <div className="ins-group" role="region" aria-label={stepLabel(step)}>
            <h2 className="ins-h">{fill(copy.report.stepOf, { n: idx + 1, total: usedSteps.length })} · {stepLabel(step)}</h2>

            {step === "overview" ? (
              <>
                <div className="ins-panel"><dl className="ins-facts">
                  <div><dt>{copy.workspace.project}</dt><dd>{d.project?.projectCode} · {d.project?.title}</dd></div>
                  <div><dt>{copy.report.claimed}</dt><dd>{claimed === null ? copy.common.notProvided : `${claimed}%`}</dd></div>
                  <div><dt>{copy.report.purposeLabel}</dt><dd>{d.purpose ?? copy.common.notProvided}</dd></div>
                  <div><dt>{copy.report.locationLabel}</dt><dd>{d.locationNote ?? copy.common.notProvided}</dd></div>
                </dl></div>
                <div className="ins-panel"><strong>{copy.report.milestonesTitle}</strong>{d.milestoneIds.length ? <ul>{d.milestoneIds.map((m) => <li key={m}>{milestones.data?.milestones.find((x) => x.id === m)?.title ?? m}</li>)}</ul> : <p className="ins-muted">{copy.report.noMilestones}</p>}</div>
              </>
            ) : null}

            {step === "checklist" ? (
              <>
                <p className="ins-muted">{copy.report.checklistHint} · {fill(copy.report.counts, { done: answered, total: template.length })}</p>
                {groups.map((g) => (
                  <div key={g} className="ins-group">
                    <div className="ins-bar"><strong>{copy.report.groups[g as keyof typeof copy.report.groups] ?? g}</strong>
                      <button type="button" className="ctr-btn is-ghost" onClick={() => change((r) => ({ ...r, checklist: r.checklist.map((c) => (template.find((t) => t.key === c.key)?.group === g && c.result === "NOT_CHECKED" ? { ...c, result: "NA" } : c)) }))}>{copy.report.markGroupNa}</button></div>
                    {template.filter((t) => t.group === g).map((t) => {
                      const c = report.checklist.find((x) => x.key === t.key) ?? { key: t.key, result: "NOT_CHECKED" as ChecklistResult };
                      return (
                        <div key={t.key} className="ins-item" data-fail={c.result === "FAIL"}>
                          <div className="ins-bar"><strong>{labels[t.key] ?? t.key}</strong>{t.mandatory ? <span className="ins-badge">{copy.report.mandatory}</span> : null}</div>
                          <div className="ins-seg3" role="group" aria-label={labels[t.key] ?? t.key}>
                            {(["PASS", "FAIL", "NA"] as const).map((r) => <button key={r} type="button" data-r={r} aria-pressed={c.result === r} onClick={() => setItem(t.key, { result: r })}>{r === "PASS" ? <CheckIcon aria-hidden="true" /> : r === "FAIL" ? <XIcon aria-hidden="true" /> : null}{r === "PASS" ? copy.report.pass : r === "FAIL" ? copy.report.fail : copy.report.na}</button>)}
                          </div>
                          {c.result === "FAIL" ? <Field label={copy.report.noteLabel} error={!c.note?.trim() ? copy.report.noteRequired : null}>{(fid) => <textarea id={fid} className="ctr-input" maxLength={500} value={c.note ?? ""} onChange={(e) => setItem(t.key, { note: e.target.value })} aria-invalid={!c.note?.trim()} />}</Field> : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            ) : null}

            {step === "observations" ? (
              <>
                {(d.aiAssistRefs?.length ?? 0) > 0 ? (
                  <div className="ctr-badge" data-tone="active" style={{ width: "fit-content", marginBottom: "0.6rem" }}>
                    <SparklesIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} />
                    <span>{getInspectionAiCopy(locale).assistMarkerBadge}</span>
                  </div>
                ) : null}
                <Field label={copy.report.siteObservations}>{(fid) => <textarea id={fid} className="ctr-input" style={{ minHeight: "7rem" }} maxLength={4000} value={report.siteObservations ?? ""} onChange={(e) => change((r) => ({ ...r, siteObservations: e.target.value }))} />}</Field><Counter value={report.siteObservations} max={4000} copy={copy} />
                <Field label={copy.report.workObservations}>{(fid) => <textarea id={fid} className="ctr-input" style={{ minHeight: "7rem" }} maxLength={4000} value={report.workCompletionObservations ?? ""} onChange={(e) => change((r) => ({ ...r, workCompletionObservations: e.target.value }))} />}</Field><Counter value={report.workCompletionObservations} max={4000} copy={copy} />
                <Field label={copy.report.safetyObservations}>{(fid) => <textarea id={fid} className="ctr-input" style={{ minHeight: "6rem" }} maxLength={3000} value={report.safetyObservations ?? ""} onChange={(e) => change((r) => ({ ...r, safetyObservations: e.target.value }))} />}</Field><Counter value={report.safetyObservations} max={3000} copy={copy} />
              </>
            ) : null}

            {step === "defects" ? (
              <>
                <p className="ins-muted">{copy.report.defectsHint}</p>
                {report.defects.length === 0 ? <p className="ins-muted">{copy.report.noDefects}</p> : null}
                {report.defects.map((df) => (
                  <div key={df.key} className="ins-item">
                    <Field label={copy.report.defectTitle}>{(fid) => <input id={fid} className="ctr-input" maxLength={160} value={df.title} onChange={(e) => setDefect(df.key, { title: e.target.value })} />}</Field>
                    <div className="ins-sev" role="group" aria-label={copy.report.severity}>{DEFECT_SEVERITIES.map((s) => <button key={s} type="button" data-s={s} aria-pressed={df.severity === s} onClick={() => setDefect(df.key, { severity: s })}>{copy.report.sev[s]}</button>)}</div>
                    <Field label={copy.report.defectLocation}>{(fid) => <input id={fid} className="ctr-input" maxLength={200} value={df.location ?? ""} onChange={(e) => setDefect(df.key, { location: e.target.value })} />}</Field>
                    <Field label={copy.report.defectDescription}>{(fid) => <textarea id={fid} className="ctr-input" maxLength={1000} value={df.description ?? ""} onChange={(e) => setDefect(df.key, { description: e.target.value })} />}</Field>
                    <label className="ins-toggle"><input type="checkbox" checked={df.reworkRequired} onChange={(e) => setDefect(df.key, { reworkRequired: e.target.checked })} />{copy.report.reworkRequired}</label>
                    <div className="ins-bar"><span className="ins-muted">{fill(copy.report.linkedPhotos, { n: d.evidence.filter((e) => e.defectKey === df.key && e.status === "ACTIVE").length })}</span>
                      <button type="button" className="ctr-btn is-ghost" onClick={() => change((r) => ({ ...r, defects: r.defects.filter((x) => x.key !== df.key) }))}><Trash2Icon aria-hidden="true" />{copy.report.removeDefect}</button></div>
                  </div>
                ))}
                <button type="button" className="ctr-btn" disabled={report.defects.length >= 30} onClick={() => change((r) => ({ ...r, defects: [...r.defects, { key: newDefectKey(r.defects.map((x) => x.key)), title: "", severity: "MINOR", reworkRequired: false }] }))}><PlusIcon aria-hidden="true" />{copy.report.addDefect}</button>
              </>
            ) : null}

            {step === "evidence" ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                <EvidencePanel inspectionId={id} evidence={d.evidence} editable copy={copy} locale={locale} items={evidenceItems} defects={report.defects.map((x) => ({ key: x.key, title: x.title }))} onChanged={refetchDetail} onBusyChange={setUploading} />
                <AiEvidenceCheck
                  mode="editor"
                  inspectionId={id}
                  evidence={d.evidence}
                  inspectionCopy={copy}
                  locale={locale}
                  onInsertedTexts={(texts) => {
                    if (texts.length === 0) return;
                    change((r) => ({
                      ...r,
                      workCompletionObservations: [r.workCompletionObservations?.trim(), ...texts]
                        .filter(Boolean)
                        .join("\n\n"),
                    }));
                    refetchDetail();
                    setStep("observations");
                  }}
                />
              </div>
            ) : null}

            {step === "progress" ? (
              <>
                <div className="ins-panel">
                  <Field label={copy.report.measured} hint={copy.report.measuredHint}>{(fid) => (
                    <>
                      <input id={fid} type="number" min={0} max={100} step={1} inputMode="numeric" className="ctr-input" value={measured ?? ""} onChange={(e) => change((r) => ({ ...r, measuredProgress: e.target.value === "" ? undefined : Math.max(0, Math.min(100, Math.round(Number(e.target.value)))) }))} />
                      <input type="range" min={0} max={100} step={1} className="ins-range" aria-label={copy.report.measured} value={measured ?? 0} onChange={(e) => change((r) => ({ ...r, measuredProgress: Number(e.target.value) }))} />
                    </>
                  )}</Field>
                  <div className="ins-meter" style={{ marginTop: "1.4rem" }}>
                    <div className="ins-meter-track" role="img" aria-label={`${copy.report.measured}: ${measured ?? "—"}%. ${copy.report.reportedClaim}: ${claimed ?? "—"}%`}>
                      <div className="ins-meter-fill" style={{ width: `${measured ?? 0}%` }} />
                      {claimed !== null ? <div className="ins-meter-claim" data-label={`${copy.report.reportedClaim} ${claimed}%`} style={{ left: `${claimed}%` }} /> : null}
                    </div>
                    <p className={diff === null ? "ins-muted" : big ? "ins-warn ins-bad" : "ins-warn ins-ok"} role="status">{diff === null ? copy.schedule.noClaim : `${copy.report.discrepancyMeter}: ${diff > 0 ? "+" : ""}${diff} · ${big ? fill(copy.report.discrepancyHigh, { pp: DISCREPANCY_THRESHOLD_PP }) : fill(copy.report.discrepancyOk, { pp: DISCREPANCY_THRESHOLD_PP })}`}</p>
                  </div>
                  {big ? <Field label={copy.report.discrepancyNote} error={!report.discrepancyNote?.trim() ? copy.common.required : null}>{(fid) => <textarea id={fid} className="ctr-input" maxLength={1000} value={report.discrepancyNote ?? ""} onChange={(e) => change((r) => ({ ...r, discrepancyNote: e.target.value }))} />}</Field> : null}
                </div>
                {d.milestoneIds.length ? (
                  <div className="ins-panel"><strong>{copy.report.milestoneAssess}</strong>
                    {d.milestoneIds.map((m) => {
                      const cur = report.milestoneAssessments.find((x) => x.milestoneId === m);
                      return <Field key={m} label={`${milestones.data?.milestones.find((x) => x.id === m)?.title ?? m} · ${copy.report.milestoneVerified}`}>{(fid) => <input id={fid} type="number" min={0} max={100} step={1} className="ctr-input" value={cur?.verifiedProgress ?? ""} onChange={(e) => change((r) => ({ ...r, milestoneAssessments: e.target.value === "" ? r.milestoneAssessments.filter((x) => x.milestoneId !== m) : [...r.milestoneAssessments.filter((x) => x.milestoneId !== m), { milestoneId: m, verifiedProgress: Math.max(0, Math.min(100, Math.round(Number(e.target.value)))) }] }))} />}</Field>;
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
            {step === "progress" || !progress ? null : null}

            {step === "submit" ? (
              <>
                {shownGaps.length === 0 ? <p className="ins-warn ins-ok">{copy.report.complete}</p> : (
                  <div><strong>{copy.report.missingTitle}</strong>
                    <ul className="ins-gaps">{shownGaps.map((g) => <li key={g}><span>{copy.report.gaps[g]}</span><button type="button" className="ctr-btn" onClick={() => goStep(GAP_STEP[g])}>{copy.report.jump}</button></li>)}</ul>
                  </div>
                )}
                {!progress ? <p className="ins-muted">{copy.report.notApplicable}</p> : null}
                <Field label={copy.report.recommendations}>{(fid) => <textarea id={fid} className="ctr-input" maxLength={3000} value={report.recommendations ?? ""} onChange={(e) => change((r) => ({ ...r, recommendations: e.target.value }))} />}</Field>
                <label className="ins-toggle"><input type="checkbox" checked={report.followUpRequired} onChange={(e) => change((r) => ({ ...r, followUpRequired: e.target.checked }))} />{copy.report.followUpRequired}</label>
                {report.followUpRequired ? <Field label={copy.report.followUpNote}>{(fid) => <textarea id={fid} className="ctr-input" maxLength={1000} value={report.followUpNote ?? ""} onChange={(e) => change((r) => ({ ...r, followUpNote: e.target.value }))} />}</Field> : null}
                <label className="ins-toggle"><input type="checkbox" checked={report.inspectorDeclaration} onChange={(e) => change((r) => ({ ...r, inspectorDeclaration: e.target.checked }))} />{copy.report.declaration}</label>
                {error ? <p className="ctr-error" role="alert">{error}</p> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ins-sticky" role="toolbar" aria-label={copy.report.title}>
        <button type="button" className="ctr-btn" disabled={idx === 0} onClick={() => setStep(usedSteps[idx - 1]!)}>{copy.report.back}</button>
        <SaveIndicator state={state} savedAt={savedAt} copy={copy} onRetry={() => { attempts.current = 0; void flushRef.current(); }} />
        {step === "submit"
          ? <button type="button" className="ctr-btn is-primary" disabled={submit.isPending || gaps.length > 0 || uploading} onClick={() => { setError(null); submit.mutate(); }}>{submit.isPending ? copy.report.submitting : copy.report.submit}</button>
          : <button type="button" className="ctr-btn is-primary" onClick={() => setStep(usedSteps[idx + 1]!)}>{copy.report.next}</button>}
      </div>

      <Dialog open={recovery !== null} onOpenChange={() => undefined}>
        <DialogContent className="ctr-dialog" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{copy.report.recovery.title}</DialogTitle><DialogDescription>{copy.report.recovery.body}</DialogDescription></DialogHeader>
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ctr-btn" onClick={() => { clearMirror(localStorage, id); setRecovery(null); }}>{copy.report.recovery.loadServer}</button>
            <button type="button" className="ctr-btn is-primary" onClick={() => { const draft = recovery!; setRecovery(null); setReport(draft); reportRef.current = draft; dirty.current = true; setState("dirty"); timer.current = setTimeout(() => void flushRef.current(), 300); }}>{copy.report.recovery.keepMine}</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={conflict !== null} onOpenChange={() => undefined}>
        <DialogContent className="ctr-dialog" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{copy.report.conflictDialog.title}</DialogTitle><DialogDescription>{copy.report.conflictDialog.body}</DialogDescription></DialogHeader>
          <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="ctr-btn" onClick={() => { clearMirror(localStorage, id); dirty.current = false; setConflict(null); initialised.current = false; setReport(null); refetchDetail(); setState("idle"); attempts.current = 0; }}>{copy.report.conflictDialog.loadServer}</button>
            <button type="button" className="ctr-btn is-primary" onClick={() => { if (conflict?.revision !== null && conflict?.revision !== undefined) revision.current = conflict.revision; setConflict(null); attempts.current = 0; dirty.current = true; void flushRef.current(); }}>{copy.report.conflictDialog.keepMine}</button>
          </div>
        </DialogContent>
      </Dialog>
    </StaffWorkspaceShell>
  );
}

export type { InspectionDetail };
