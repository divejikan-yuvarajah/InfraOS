"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangleIcon, FlaskConicalIcon, Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { BAND_COLOR, fmt } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { fetchDossier } from "@/lib/roadsync/conflict-records-api";
import { fetchConflictCoordination } from "@/lib/roadsync/coordination-api";
import { toIso, toLocalInput } from "@/lib/roadsync/resolution";
import { LEVER_KINDS, MAX_COMPARE, MAX_LEVERS, MEASURES, defaultLever, leverTarget, newKey, type DraftLever, type Hours, type Lever, type LeverKind, type Run, type SimResult, type Visibility } from "@/lib/roadsync/simulator";
import { fetchScenarios, removeScenario, runSimulation, saveScenario } from "@/lib/roadsync/simulator-api";
import { getSimCopy, type SimCopy } from "@/lib/roadsync/simulator-copy";
import "@/styles/mission-control-roadsync-lab.css";

import { useRoadsyncKeys, whenFmt } from "./resolution-tab";

type Target = { id: string; label: string; mine: boolean };
const HOURS: Hours[] = ["day", "night", "24h"];

export function ScenarioLab({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const copy = getSimCopy(locale);
  const ac = getAssessmentCopy(locale);
  const keys = useRoadsyncKeys();
  const qc = useQueryClient();
  const enabled = Boolean(keys.userId);
  const dossier = useQuery({ queryKey: keys.key("lab-dossier", id), queryFn: () => fetchDossier(id), enabled, retry: false });
  const coord = useQuery({ queryKey: keys.key("lab-coordination", id), queryFn: () => fetchConflictCoordination(id), enabled: enabled && Boolean(dossier.data), retry: false });
  const saved = useQuery({ queryKey: keys.key("lab-scenarios", id), queryFn: () => fetchScenarios(id), enabled: enabled && Boolean(dossier.data), retry: false });
  const [levers, setLevers] = useState<DraftLever[]>([]);
  const [result, setResult] = useState<{ result: SimResult; snapshot: string | null } | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");

  const d = dossier.data;
  const targets: Target[] = d ? ([d.parties.a, d.parties.b].filter((p) => p.sourceType === "work_request").map((p) => ({ id: p.id, label: `${p.ref}${p.agencyName ? ` · ${p.agencyName}` : ""}`, mine: p.mine }))) : [];
  const agreed = (coord.data?.items ?? []).filter((r) => r.status === "agreed");
  const ctx = { first: targets[0]?.id ?? "", second: targets[1]?.id ?? targets[0]?.id ?? "", replayId: agreed[0]?.id ?? "" };
  const plain = levers.map((x) => x.lever);
  const datesBad = plain.some((l) => (l.kind === "shift" || l.kind === "ghost") && new Date(l.end) < new Date(l.start));
  const replayMissing = plain.some((l) => l.kind === "replay" && !l.coordinationRequestId);
  const canRun = levers.length > 0 && !datesBad && !replayMissing && targets.length > 0;
  const fail = (e: unknown) => setToast(e instanceof ApiError && e.status === 403 ? copy.forbidden : e instanceof ApiError && e.status === 409 ? copy.limit : copy.failed);

  const run = useMutation({ mutationFn: () => runSimulation(id, plain), onSuccess: (r) => { setResult({ result: r.result, snapshot: null }); setToast(null); }, onError: fail });
  const save = useMutation({
    mutationFn: () => saveScenario(id, { name: name.trim(), visibility, levers: plain }),
    onSuccess: () => { setToast(copy.savedOk); setName(""); void qc.invalidateQueries({ queryKey: keys.key("lab-scenarios", id) }); }, onError: fail,
  });
  const del = useMutation({ mutationFn: (sid: string) => removeScenario(sid), onSuccess: () => void qc.invalidateQueries({ queryKey: keys.key("lab-scenarios", id) }), onError: fail });

  const update = (key: string, lever: Lever) => setLevers((cur) => cur.map((x) => (x.key === key ? { key, lever } : x)));
  const add = (kind: LeverKind) => { if (levers.length < MAX_LEVERS) setLevers((cur) => [...cur, { key: newKey(), lever: defaultLever(kind, ctx) }]); };
  const addRun = () => { if (result && runs.length < MAX_COMPARE) setRuns((cur) => [...cur, { id: newKey(), label: fmt(copy.compare.label, { n: cur.length + 1 }), levers: plain, result: result.result }]); };

  if (dossier.isPending) return <Shell copy={copy} id={id}><p className="rs-help" role="status">{copy.loading}</p></Shell>;
  if (dossier.isError || !d) {
    const status = dossier.error instanceof ApiError ? dossier.error.status : 0;
    return <Shell copy={copy} id={id}><div className="rz-state" role="alert"><p>{status === 403 || status === 404 ? copy.forbidden : copy.error}</p><button type="button" className="rs-btn" onClick={() => void dossier.refetch()}>{copy.retry}</button></div></Shell>;
  }
  return (
    <Shell copy={copy} id={id} no={d.conflictNo}>
      {toast ? <p className="rz-toast" role="status">{toast}</p> : null}
      <section className="rz-sec" aria-labelledby="sl-levers">
        <h2 id="sl-levers" className="sl-h"><FlaskConicalIcon aria-hidden="true" />{copy.f.add}</h2>
        <div className="sl-add" role="group" aria-label={copy.f.add}>
          {LEVER_KINDS.map((k) => <button key={k} type="button" className="rs-btn" disabled={levers.length >= MAX_LEVERS || (k === "replay" && agreed.length === 0)} title={k === "replay" && agreed.length === 0 ? copy.f.noAgreed : copy.help[k]} onClick={() => add(k)}><PlusIcon aria-hidden="true" />{copy.lever[k]}</button>)}
        </div>
        <p className="rs-help">{fmt(copy.f.max, { n: MAX_LEVERS })}</p>
        {levers.length === 0 ? <p className="rz-empty">{copy.f.none}</p> : <ul className="rz-list">{levers.map((x) => <LeverRow key={x.key} x={x} copy={copy} targets={targets} agreed={agreed.map((a) => ({ id: a.id, label: a.requestNo }))} onChange={(l) => update(x.key, l)} onRemove={() => setLevers((cur) => cur.filter((y) => y.key !== x.key))} />)}</ul>}
        {datesBad ? <p className="rz-warn" role="alert">{copy.f.datesInvalid}</p> : null}
        <div className="rz-actions"><button type="button" className="rs-btn is-primary" disabled={!canRun || run.isPending} aria-busy={run.isPending} onClick={() => run.mutate()}>{run.isPending ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : <FlaskConicalIcon aria-hidden="true" />}{run.isPending ? copy.running : copy.run}</button></div>
      </section>

      {result ? (
        <section className="rz-sec" aria-labelledby="sl-result"><h2 id="sl-result" className="sl-h">{copy.result}</h2>
          {result.snapshot ? <p className="rs-help">{result.snapshot}</p> : null}
          <ResultCard r={result.result} copy={copy} bands={ac.bands} />
          <div className="rz-actions">
            <button type="button" className="rs-btn" disabled={runs.length >= MAX_COMPARE} onClick={addRun}>{runs.length >= MAX_COMPARE ? fmt(copy.compare.full, { n: MAX_COMPARE }) : copy.compare.add}</button>
          </div>
          <form className="sl-save" onSubmit={(e) => { e.preventDefault(); if (name.trim() && plain.length) save.mutate(); }}>
            <div className="rs-field"><label className="rs-label" htmlFor="sl-name">{copy.saved.name}</label><input id="sl-name" className="rs-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
            <div className="rs-field"><label className="rs-label" htmlFor="sl-vis">{copy.saved.visibility}</label><select id="sl-vis" className="rs-input" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>{(["private", "agency", "national"] as const).map((v) => <option key={v} value={v}>{copy.saved.vis[v]}</option>)}</select></div>
            <button type="submit" className="rs-btn" disabled={!name.trim() || save.isPending}><SaveIcon aria-hidden="true" />{copy.saved.save}</button>
          </form>
          <p className="rs-help">{copy.saved.note}</p>
        </section>
      ) : null}

      <section className="rz-sec" aria-labelledby="sl-compare"><h2 id="sl-compare" className="sl-h">{copy.compare.title}</h2>
        {runs.length === 0 ? <p className="rs-help">{copy.compare.empty}</p> : (
          <>
            <div className="dc-tscroll"><table className="sl-table"><thead><tr><th scope="col">{copy.compare.metric}</th>{runs.map((r) => <th key={r.id} scope="col">{r.label}</th>)}</tr></thead>
              <tbody>
                {([["pairAfter", (r: SimResult) => String(r.pair.after.score)], ["band", (r: SimResult) => ac.bands[r.pair.after.band]], ["verdict", (r: SimResult) => copy.verdict[r.verdict] ?? r.verdict], ["total", (r: SimResult) => String(r.request.after.conflictCount)], ["newC", (r: SimResult) => String(r.thirdParty.newConflicts)], ["worsened", (r: SimResult) => String(r.thirdParty.worsened)], ["cleared", (r: SimResult) => String(r.thirdParty.cleared)]] as const).map(([k, f]) => <tr key={k}><th scope="row">{copy.compare[k]}</th>{runs.map((r) => <td key={r.id}>{f(r.result)}</td>)}</tr>)}
              </tbody></table></div>
            <div className="rz-actions"><button type="button" className="rs-btn" onClick={() => setRuns([])}>{copy.compare.clear}</button></div>
          </>
        )}
      </section>

      <section className="rz-sec" aria-labelledby="sl-saved"><h2 id="sl-saved" className="sl-h">{copy.saved.title}</h2>
        {saved.isPending ? <p className="rs-help" role="status">{copy.loading}</p> : saved.isError ? <div className="rz-state" role="alert"><p>{copy.error}</p><button type="button" className="rs-btn" onClick={() => void saved.refetch()}>{copy.retry}</button></div>
          : saved.data.items.length === 0 ? <p className="rs-help">{copy.saved.empty}</p> : (
            <ul className="rz-list">{saved.data.items.map((s) => (
              <li key={s.id} className="rz-card"><div className="rz-card-top"><strong>{s.name}</strong><span className="rs-nb-chip">{copy.saved.vis[s.visibility]}</span><span className="rz-chip" data-status={s.result.verdict === "clears" ? "resolved" : s.result.verdict === "raises" ? "cancelled" : "pending_approval"}>{copy.verdict[s.result.verdict]}</span></div>
                <p className="rs-help">{fmt(copy.saved.snapshot, { when: whenFmt(locale, s.createdAt) })} · {fmt(copy.score, { a: s.result.pair.before.score, b: s.result.pair.after.score })}</p>
                <div className="rz-row-actions">
                  <button type="button" className="rs-btn" onClick={() => { setLevers(s.levers.map((l) => ({ key: newKey(), lever: l }))); setResult({ result: s.result, snapshot: fmt(copy.saved.snapshot, { when: whenFmt(locale, s.createdAt) }) }); }}>{copy.saved.load}</button>
                  {s.mine ? <button type="button" className="rs-btn" disabled={del.isPending} onClick={() => del.mutate(s.id)}><Trash2Icon aria-hidden="true" />{copy.saved.delete}</button> : null}
                </div></li>
            ))}</ul>
          )}
      </section>
    </Shell>
  );
}

function Shell({ copy, id, no, children }: { copy: SimCopy; id: string; no?: string; children: React.ReactNode }) {
  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <div className="rz sl">
        <p className="rs-help">{copy.demoNote}</p>
        <div className="rz-actions"><Link className="rs-btn" href={`/roadsync/conflicts/${id}?tab=resolution`}>{copy.back}{no ? ` ${no}` : ""}</Link></div>
        {children}
      </div>
    </StaffWorkspaceShell>
  );
}

function LeverRow({ x, copy, targets, agreed, onChange, onRemove }: { x: DraftLever; copy: SimCopy; targets: Target[]; agreed: { id: string; label: string }[]; onChange: (l: Lever) => void; onRemove: () => void }) {
  const l = x.lever;
  const tgt = leverTarget(l);
  const owner = targets.find((t) => t.id === tgt);
  const uid = (s: string) => `${x.key}-${s}`;
  const pick = (value: string, set: (v: string) => void, label: string, suffix: string) => (
    <div className="rs-field"><label className="rs-label" htmlFor={uid(suffix)}>{label}</label>
      <select id={uid(suffix)} className="rs-input" value={value} onChange={(e) => set(e.target.value)}>{targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
  );
  const dates = (start: string, end: string, set: (s: string, e: string) => void) => (
    <>
      <div className="rs-field"><label className="rs-label" htmlFor={uid("s")}>{copy.f.start}</label><input id={uid("s")} type="datetime-local" className="rs-input" value={toLocalInput(start)} onChange={(e) => e.target.value && set(toIso(e.target.value), end)} /></div>
      <div className="rs-field"><label className="rs-label" htmlFor={uid("e")}>{copy.f.end}</label><input id={uid("e")} type="datetime-local" className="rs-input" value={toLocalInput(end)} onChange={(e) => e.target.value && set(start, toIso(e.target.value))} /></div>
    </>
  );
  const hoursSel = (value: string, set: (h: Hours) => void, optional = false) => (
    <div className="rs-field"><label className="rs-label" htmlFor={uid("h")}>{copy.f.hours}</label>
      <select id={uid("h")} className="rs-input" value={value} onChange={(e) => set(e.target.value as Hours)}>{optional ? <option value="">—</option> : null}{HOURS.map((h) => <option key={h} value={h}>{copy.f.hoursOpt[h]}</option>)}</select></div>
  );
  return (
    <li className="rz-card sl-lever">
      <div className="rz-card-top"><strong>{copy.lever[l.kind]}</strong>
        {owner ? <span className="rs-nb-chip">{owner.mine ? copy.f.mine : copy.f.other}</span> : null}
        {owner && !owner.mine ? <span className="rz-chip" data-status="pending_approval"><AlertTriangleIcon aria-hidden="true" />{copy.f.assumption}</span> : null}
        <button type="button" className="rs-btn sl-remove" onClick={onRemove}><Trash2Icon aria-hidden="true" />{copy.f.remove}</button></div>
      <p className="rs-help">{copy.help[l.kind]}</p>
      <div className="rz-fields">
        {l.kind === "shift" ? <>{pick(l.requestId, (v) => onChange({ ...l, requestId: v }), copy.f.request, "t")}{dates(l.start, l.end, (s, e) => onChange({ ...l, start: s, end: e }))}</> : null}
        {l.kind === "hours" ? <>{pick(l.requestId, (v) => onChange({ ...l, requestId: v }), copy.f.request, "t")}{hoursSel(l.workingHours, (h) => onChange({ ...l, workingHours: h }))}</> : null}
        {l.kind === "buffer" ? <div className="rs-field"><label className="rs-label" htmlFor={uid("d")}>{copy.f.days}</label><input id={uid("d")} type="number" min={0} max={180} className="rs-input" value={l.days} onChange={(e) => onChange({ ...l, days: Math.max(0, Math.min(180, Math.floor(Number(e.target.value) || 0))) })} /></div> : null}
        {l.kind === "sequence" ? <>{pick(l.firstRequestId, (v) => onChange({ ...l, firstRequestId: v }), copy.f.first, "a")}{pick(l.secondRequestId, (v) => onChange({ ...l, secondRequestId: v }), copy.f.second, "b")}<div className="rs-field"><label className="rs-label" htmlFor={uid("g")}>{copy.f.gap}</label><input id={uid("g")} type="number" min={0} max={180} className="rs-input" value={l.gapDays} onChange={(e) => onChange({ ...l, gapDays: Math.max(0, Math.min(180, Math.floor(Number(e.target.value) || 0))) })} /></div></> : null}
        {l.kind === "traffic" ? <>{pick(l.requestId, (v) => onChange({ ...l, requestId: v }), copy.f.request, "t")}
          <fieldset className="rz-mits"><legend>{copy.f.measures}</legend>{MEASURES.map((m) => <label key={m} className="rz-check"><input type="checkbox" checked={l.measures.includes(m)} onChange={(e) => { const next = e.target.checked ? [...l.measures, m] : l.measures.filter((y) => y !== m); if (next.length) onChange({ ...l, measures: next }); }} />{copy.measures[m]}</label>)}</fieldset></> : null}
        {l.kind === "cancel" ? pick(l.requestId, (v) => onChange({ ...l, requestId: v }), copy.f.request, "t") : null}
        {l.kind === "ghost" ? <>{pick(l.sourceRequestId, (v) => onChange({ ...l, sourceRequestId: v }), copy.f.source, "t")}{dates(l.start, l.end, (s, e) => onChange({ ...l, start: s, end: e }))}{hoursSel(l.workingHours ?? "", (h) => { const { workingHours: _w, ...rest } = l; void _w; onChange(h ? { ...rest, workingHours: h } : rest); }, true)}</> : null}
        {l.kind === "replay" ? <div className="rs-field"><label className="rs-label" htmlFor={uid("r")}>{copy.f.agreed}</label><select id={uid("r")} className="rs-input" value={l.coordinationRequestId} onChange={(e) => onChange({ ...l, coordinationRequestId: e.target.value })}>{agreed.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div> : null}
      </div>
    </li>
  );
}

function ResultCard({ r, copy, bands }: { r: SimResult; copy: SimCopy; bands: Record<string, string> }) {
  const chip = (s: { score: number; band: string }) => <span className="sl-band" style={{ ["--c" as string]: BAND_COLOR[s.band as keyof typeof BAND_COLOR] }}>{bands[s.band] ?? s.band} · {s.score}</span>;
  return (
    <div className="sl-result">
      <p className="sl-verdict" data-v={r.verdict}>{copy.verdict[r.verdict] ?? r.verdict}</p>
      <div className="sl-grid">
        <div><h3 className="dc-h3">{copy.pair}</h3><p>{chip(r.pair.before)} → {chip(r.pair.after)}</p><p className="rs-help">{copy.kind[r.pair.before.kind] ?? r.pair.before.kind} → {copy.kind[r.pair.after.kind] ?? r.pair.after.kind}</p></div>
        <div><h3 className="dc-h3">{copy.request}</h3><p>{fmt(copy.riskIndex, { a: r.request.before.riskIndex, b: r.request.after.riskIndex })}</p><p>{fmt(copy.conflictsCount, { a: r.request.before.conflictCount, b: r.request.after.conflictCount })}</p></div>
        <div><h3 className="dc-h3">{copy.third}</h3><p>{fmt(copy.newC, { n: r.thirdParty.newConflicts })} · {fmt(copy.worsened, { n: r.thirdParty.worsened })} · {fmt(copy.cleared, { n: r.thirdParty.cleared })}</p></div>
      </div>
      {r.ghost ? <p>{r.ghost.newConflicts ? fmt(copy.ghost, { n: r.ghost.newConflicts, p: r.ghost.pairs }) : copy.ghostNone}</p> : null}
      {r.commitments.length ? <ul className="rz-chips">{r.commitments.flatMap((c) => c.measures).map((m, i) => <li key={`${m}${i}`} className="rs-nb-chip">{copy.measures[m] ?? m}</li>)}</ul> : null}
      {r.warnings.map((w) => <p key={w} className="rz-warn" role="note">{copy.warn[w] ?? w}</p>)}
      {r.actionable ? <p className="rs-help">{copy.actionable}</p> : r.levers.some((x) => x.assumption) ? <p className="rz-warn" role="note">{copy.assumptionNote}</p> : null}
      <p className="rs-help">{copy.coverage}</p>
    </div>
  );
}
