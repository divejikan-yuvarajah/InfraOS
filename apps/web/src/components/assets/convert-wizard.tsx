"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, CheckCircle2Icon, CircleSlashIcon, ClockIcon, PlusIcon, Trash2Icon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { approveConversion, fetchConvertibleProjects, previewConversion, requestConversion } from "@/lib/assets/api";
import { getAssetCopy, type Copy } from "@/lib/assets/messages";
import { useAssetKeys } from "@/lib/assets/session";
import { ASSET_CONDITIONS, ASSET_TYPES, type AssetCondition, type AssetType, type Gate, type GateStatus, type ProposedAsset } from "@/lib/assets/types";
import { fill } from "@/lib/assets/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { colomboToIso } from "@/lib/inspections/calendar-math";

import { EmptyState, errorText, ErrorState, Field, Skeletons } from "./asset-ui";

const STEPS = ["project", "readiness", "assets", "handover", "review"] as const;
type Step = (typeof STEPS)[number];
const GATE_ICON: Record<GateStatus, typeof CheckCircle2Icon> = { PASS: CheckCircle2Icon, WARN: AlertTriangleIcon, BLOCK: XCircleIcon, SKIPPED: ClockIcon };
const FIX_LINK: Record<string, (projectId: string) => string> = {
  OPEN_FINDINGS: (p) => `/inspections?projectId=${p}`, VERIFIED_COMPLETION: (p) => `/inspections?projectId=${p}`, FINANCIAL_CLOSURE: () => "/finance", CONTRACTOR_HANDOVER: () => "/contractors",
  GEOMETRY: (p) => `/projects/${p}/overview`, DOCUMENTS: (p) => `/projects/${p}/overview`,
};

export function GateList({ gates, copy, projectId }: { gates: Gate[]; copy: Copy; projectId?: string }) {
  const names = copy.wizard.gates as Record<string, string>;
  const fixes = copy.wizard.fix as Record<string, string>;
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {gates.map((g) => {
        const Icon = GATE_ICON[g.status];
        return (
          <div key={g.key} className="ast-gate" data-s={g.status}>
            <Icon aria-hidden="true" />
            <div className="ast-gate-body">
              <strong>{names[g.key] ?? g.key} · {copy.wizard.gateStatus[g.status]}</strong>
              <span className="ins-muted">{g.message}</span>
              {projectId && g.status !== "PASS" && g.status !== "SKIPPED" && FIX_LINK[g.key] && fixes[g.key] ? <Link className="ins-link" href={FIX_LINK[g.key]!(projectId)}>{fixes[g.key]}</Link> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Draft = { key: string; name: string; assetType: AssetType; description: string; district: string; locality: string; roadName: string; useGeometry: boolean; commissionedAt: string; designLife: string; interval: string };

export function ConvertWizard() {
  const [locale] = useWorkspaceLocale();
  const copy = getAssetCopy(locale);
  const w = copy.wizard;
  const router = useRouter();
  const sp = useSearchParams();
  const { key, roleKey } = useAssetKeys();
  const [step, setStep] = useState<Step>(sp.get("projectId") ? "readiness" : "project");
  const [projectId, setProjectId] = useState(sp.get("projectId") ?? "");
  const [q, setQ] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [receiving, setReceiving] = useState("");
  const [handoverDate, setHandoverDate] = useState("");
  const [note, setNote] = useState("");
  const [dlp, setDlp] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("UNKNOWN");
  const [docs, setDocs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; no: string } | null>(null);

  const projects = useQuery({ queryKey: key("convertible", q), queryFn: () => fetchConvertibleProjects({ q: q || undefined }), enabled: step === "project" });
  const preview = useQuery({ queryKey: key("preview", projectId, receiving), queryFn: ({ signal }) => previewConversion({ projectId, receivingAgencyId: receiving || undefined }, signal), enabled: Boolean(projectId) && step !== "project" });
  const p = preview.data;

  // Seed the proposed-asset editor once from the server's suggestions; never overwrite the user's edits afterwards.
  const effectiveDrafts: Draft[] = drafts ?? (p ? [{ key: "asset_1", name: p.suggestions.name, assetType: p.suggestions.assetType, description: "", district: "", locality: "", roadName: "", useGeometry: p.suggestions.hasGeometry, commissionedAt: "", designLife: "", interval: String(p.suggestions.defaultMonitoringDays) }] : []);
  const setDraft = (i: number, patch: Partial<Draft>) => setDrafts(effectiveDrafts.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const names = effectiveDrafts.map((d) => d.name.trim().toLowerCase());
  const assetsOk = effectiveDrafts.length > 0 && effectiveDrafts.every((d) => d.name.trim().length > 1 && Number(d.interval) >= 30 && Number(d.interval) <= 1825 && (!d.designLife || (Number(d.designLife) >= 1 && Number(d.designLife) <= 150))) && new Set(names).size === names.length;
  const receivingId = receiving || p?.suggestions.receivingAgencyId || "";
  const handoverOk = Boolean(handoverDate) && Boolean(receivingId);
  const warn = p?.gates.some((g) => g.status === "WARN") ?? false;
  const readinessOk = Boolean(p) && !p!.blocked && (!warn || understood);

  const proposed = (): ProposedAsset[] => effectiveDrafts.map((d) => ({
    key: d.key, assetType: d.assetType, name: d.name.trim(), ...(d.description.trim() ? { description: d.description.trim() } : {}),
    ...(d.district.trim() || d.locality.trim() || d.roadName.trim() ? { location: { ...(d.district.trim() ? { district: d.district.trim() } : {}), ...(d.locality.trim() ? { locality: d.locality.trim() } : {}), ...(d.roadName.trim() ? { roadName: d.roadName.trim() } : {}) } } : {}),
    geometrySource: d.useGeometry && p?.suggestions.hasGeometry ? "PROJECT" : "NONE",
    ...(d.commissionedAt ? { commissionedAt: colomboToIso(d.commissionedAt, "00:00") ?? undefined } : {}), ...(d.designLife ? { designLifeYears: Number(d.designLife) } : {}), monitoringIntervalDays: Number(d.interval),
  } as ProposedAsset));

  const submit = useMutation({
    mutationFn: () => requestConversion({
      projectId, ...(receivingId ? { receivingAgencyId: receivingId } : {}),
      handover: { handoverDate: colomboToIso(handoverDate, "00:00"), ...(note.trim() ? { handoverNote: note.trim() } : {}), ...(dlp ? { defectsLiabilityEndsOn: colomboToIso(dlp, "00:00") } : {}), documentIds: docs, conditionAtHandover: condition },
      proposedAssets: proposed(), ...(warn ? { acknowledgeWarnings: true } : {}),
    }),
    onSuccess: (r) => { setDone({ id: r.id, no: r.conversionNo }); toast.success(fill(w.success, { no: r.conversionNo })); },
    onError: (e) => setError(errorText(e, copy)),
  });
  const approveNow = useMutation({ mutationFn: () => approveConversion(done!.id), onSuccess: (r) => { toast.success(copy.queue.approved); router.push(r.assets[0] ? `/assets/${r.assets[0].id}` : "/assets"); }, onError: (e) => setError(errorText(e, copy)) });

  const idx = STEPS.indexOf(step);
  const go = (s: Step) => { setError(null); setStep(s); };
  const canNext = step === "project" ? Boolean(projectId) : step === "readiness" ? readinessOk : step === "assets" ? assetsOk : step === "handover" ? handoverOk : false;
  const selectedProject = projects.data?.projects.find((x) => x.id === projectId) ?? (p ? { id: projectId, projectCode: p.project.projectCode, title: p.project.title } : null);

  return (
    <StaffWorkspaceShell title={w.title} description={w.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.assets, href: "/assets" }, { label: copy.nav.convert }]} scope={copy.dashboard.scope} asOf={null} />}>
      <div className="ins ast">
        <ol className="ast-steps" aria-label={w.title}>{STEPS.map((s, i) => <li key={s} aria-current={i === idx ? "step" : undefined}>{w.steps[s]}</li>)}</ol>

        {done ? (
          <section className="ins-panel" role="status">
            <h2 className="ins-h">{fill(w.success, { no: done.no })}</h2>
            <p>{w.waiting}</p>
            {error ? <p className="ctr-error" role="alert">{error}</p> : null}
            <div className="ctr-row">
              {roleKey === "GOV_ADMIN" || roleKey === "SUPER_ADMIN" ? <button type="button" className="ctr-btn is-primary" disabled={approveNow.isPending} onClick={() => approveNow.mutate()}>{approveNow.isPending ? copy.common.working : w.approveNow}</button> : null}
              <Link className="ctr-btn" href="/assets/conversions">{w.viewQueue}</Link>
            </div>
          </section>
        ) : (
          <form className="ins-panel" onSubmit={(e) => { e.preventDefault(); if (step === "review") { setError(null); submit.mutate(); } else if (canNext) go(STEPS[idx + 1]!); }}>
            {step === "project" ? (
              <>
                <h2 className="ins-h">{w.selectProject}</h2>
                <Field label={copy.common.search}>{(id) => <input id={id} type="search" className="ctr-input" placeholder={w.searchProjects} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
                {projects.isPending ? <Skeletons n={2} /> : projects.isError ? <ErrorState error={projects.error} copy={copy} onRetry={() => void projects.refetch()} /> : projects.data.projects.length === 0 ? <EmptyState title={w.noProjects} /> : (
                  <div className="ins-proj-list">{projects.data.projects.map((x) => (
                    <button key={x.id} type="button" className="ins-proj" aria-pressed={projectId === x.id} onClick={() => { setProjectId(x.id); setDrafts(null); setUnderstood(false); }}>
                      <strong>{x.projectCode}</strong><span className="ins-muted">{x.title}</span><span className="ins-muted">{x.verifiedPercent === null ? w.notVerified : fill(w.verified, { pct: x.verifiedPercent })}</span>
                    </button>
                  ))}</div>
                )}
              </>
            ) : null}

            {step === "readiness" ? (
              <>
                <h2 className="ins-h">{w.readinessTitle}{selectedProject ? `: ${selectedProject.projectCode}` : ""}</h2>
                {preview.isPending ? <Skeletons n={3} /> : preview.isError ? <ErrorState error={preview.error} copy={copy} onRetry={() => void preview.refetch()} /> : p ? (
                  <>
                    <p role="status">{p.blocked ? w.blocked : warn ? w.warnings : w.allClear}</p>
                    <GateList gates={p.gates} copy={copy} projectId={projectId} />
                    {!p.blocked && warn ? <label className="ins-toggle"><input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />{w.understand}</label> : null}
                  </>
                ) : null}
              </>
            ) : null}

            {step === "assets" ? (
              <>
                <h2 className="ins-h">{w.assetsTitle}</h2>
                <p className="ins-muted">{w.max}</p>
                {effectiveDrafts.map((d, i) => (
                  <div key={d.key} className="ast-asset-card">
                    <div className="ctr-row">
                      <Field label={w.name} wide error={names.indexOf(d.name.trim().toLowerCase()) !== i ? copy.errors.validation : null}>{(id) => <input id={id} className="ctr-input" maxLength={200} value={d.name} onChange={(e) => setDraft(i, { name: e.target.value })} required />}</Field>
                      <Field label={w.type}>{(id) => <select id={id} className="ctr-input" value={d.assetType} onChange={(e) => setDraft(i, { assetType: e.target.value as AssetType })}>{ASSET_TYPES.map((t) => <option key={t} value={t}>{copy.assetType[t]}</option>)}</select>}</Field>
                    </div>
                    <div className="ctr-row">
                      <Field label={w.district}>{(id) => <input id={id} className="ctr-input" maxLength={100} value={d.district} onChange={(e) => setDraft(i, { district: e.target.value })} />}</Field>
                      <Field label={w.locality}>{(id) => <input id={id} className="ctr-input" maxLength={120} value={d.locality} onChange={(e) => setDraft(i, { locality: e.target.value })} />}</Field>
                      <Field label={w.roadName}>{(id) => <input id={id} className="ctr-input" maxLength={160} value={d.roadName} onChange={(e) => setDraft(i, { roadName: e.target.value })} />}</Field>
                    </div>
                    <div className="ctr-row">
                      <Field label={w.commissioned}>{(id) => <input id={id} type="date" className="ctr-input" value={d.commissionedAt} onChange={(e) => setDraft(i, { commissionedAt: e.target.value })} />}</Field>
                      <Field label={w.designLife}>{(id) => <input id={id} type="number" min={1} max={150} className="ctr-input" value={d.designLife} onChange={(e) => setDraft(i, { designLife: e.target.value })} />}</Field>
                      <Field label={w.interval}>{(id) => <input id={id} type="number" min={30} max={1825} className="ctr-input" value={d.interval} onChange={(e) => setDraft(i, { interval: e.target.value })} />}</Field>
                    </div>
                    <label className="ins-toggle"><input type="checkbox" checked={d.useGeometry && Boolean(p?.suggestions.hasGeometry)} disabled={!p?.suggestions.hasGeometry} onChange={(e) => setDraft(i, { useGeometry: e.target.checked })} />{p?.suggestions.hasGeometry ? w.useProject : w.noMap}</label>
                    <span className="ins-muted">{d.useGeometry && p?.suggestions.hasGeometry ? w.mapHint : w.noMapHint}</span>
                    {effectiveDrafts.length > 1 ? <button type="button" className="ctr-btn is-ghost" onClick={() => setDrafts(effectiveDrafts.filter((_, k) => k !== i))}><Trash2Icon aria-hidden="true" />{w.removeAsset}</button> : null}
                  </div>
                ))}
                {effectiveDrafts.length < 10 ? <button type="button" className="ctr-btn" onClick={() => { let n = effectiveDrafts.length + 1; while (effectiveDrafts.some((d) => d.key === `asset_${n}`)) n += 1; setDrafts([...effectiveDrafts, { key: `asset_${n}`, name: "", assetType: effectiveDrafts[0]?.assetType ?? "ROAD", description: "", district: "", locality: "", roadName: "", useGeometry: false, commissionedAt: "", designLife: "", interval: effectiveDrafts[0]?.interval ?? "365" }]); }}><PlusIcon aria-hidden="true" />{w.addAsset}</button> : null}
              </>
            ) : null}

            {step === "handover" ? (
              <>
                <h2 className="ins-h">{w.handoverTitle}</h2>
                <div className="ctr-row">
                  <Field label={w.handoverDate}>{(id) => <input id={id} type="date" className="ctr-input" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} required />}</Field>
                  <Field label={w.receiving}>{(id) => <select id={id} className="ctr-input" value={receivingId} onChange={(e) => setReceiving(e.target.value)}>{(p?.receivingOptions ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}</Field>
                </div>
                <div className="ctr-row">
                  <Field label={w.dlpEnds} hint={w.dlpHint}>{(id) => <input id={id} type="date" className="ctr-input" value={dlp} onChange={(e) => setDlp(e.target.value)} />}</Field>
                  <Field label={w.conditionAtHandover} hint={w.conditionHint}>{(id) => <select id={id} className="ctr-input" value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)}>{ASSET_CONDITIONS.map((c) => <option key={c} value={c}>{copy.condition[c]}</option>)}</select>}</Field>
                </div>
                <Field label={w.note}>{(id) => <textarea id={id} className="ctr-input" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
                {p?.documents.length ? (
                  <fieldset className="ctr-field"><legend className="ctr-label">{w.documents}</legend><p className="ctr-small">{w.docsHint}</p>
                    {p.documents.slice(0, 20).map((d) => <label key={d.id} className="ins-toggle"><input type="checkbox" checked={docs.includes(d.id)} onChange={(e) => setDocs(e.target.checked ? [...docs, d.id] : docs.filter((x) => x !== d.id))} />{d.fileName}</label>)}
                  </fieldset>
                ) : null}
              </>
            ) : null}

            {step === "review" && p ? (
              <>
                <h2 className="ins-h">{w.reviewTitle}</h2>
                <p>{fill(w.summary, { n: effectiveDrafts.length, project: p.project.projectCode, agency: p.receivingOptions.find((o) => o.id === receivingId)?.name ?? "—" })}</p>
                <GateList gates={p.gates} copy={copy} />
                <ul>{effectiveDrafts.map((d) => <li key={d.key}><strong>{d.name}</strong> · {copy.assetType[d.assetType]} · {d.useGeometry && p.suggestions.hasGeometry ? w.useProject : w.noMap}</li>)}</ul>
                <p className="ins-muted">{w.handoverDate}: {handoverDate} · {w.conditionAtHandover}: {copy.condition[condition]}{dlp ? ` · ${w.dlpEnds}: ${dlp}` : ""}</p>
              </>
            ) : null}

            {error ? <p className="ctr-error" role="alert">{error}</p> : null}
            <div className="ctr-row" style={{ justifyContent: "space-between" }}>
              <button type="button" className="ctr-btn" onClick={() => (idx === 0 ? router.push("/assets") : go(STEPS[idx - 1]!))}>{idx === 0 ? copy.common.cancel : copy.common.back}</button>
              <button type="submit" className="ctr-btn is-primary" disabled={step === "review" ? submit.isPending : !canNext}>{step === "review" ? (submit.isPending ? w.submitting : w.submit) : copy.common.next}</button>
            </div>
          </form>
        )}
        <p className="ins-muted"><CircleSlashIcon aria-hidden="true" style={{ width: "0.9rem", verticalAlign: "middle" }} /> {copy.common.syntheticNote}</p>
      </div>
    </StaffWorkspaceShell>
  );
}
