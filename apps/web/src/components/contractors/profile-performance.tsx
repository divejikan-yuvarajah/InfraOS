"use client";

import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AuthLocale } from "@/lib/auth/types";
import { fill, formatDate, percent } from "@/lib/contractors/format";
import type { Copy } from "@/lib/contractors/messages";
import type { EvidenceRef, Indicator, Performance, RiskFlag } from "@/lib/contractors/types";

import { BandChip, EvidenceMeter, SeverityBadge } from "./contractor-badges";

type IndicatorKey = keyof Copy["performance"]["indicators"];

/** Deep link for a piece of evidence; certifications and profile gaps have no page of their own, so they switch to the Compliance tab. */
export function evidenceHref(r: EvidenceRef): string | null {
  if (r.kind === "milestone" && r.projectId) return `/projects/${r.projectId}/milestones`;
  if ((r.kind === "project" || r.kind === "assignment" || r.kind === "inspection") && (r.projectId || r.kind === "project")) return `/projects/${r.projectId ?? r.id}/overview`;
  return null;
}

export function EvidenceDrawer({ open, onOpenChange, title, refs, copy, onOpenCompliance }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; refs: EvidenceRef[]; copy: Copy; onOpenCompliance: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" aria-label={copy.evidenceDrawer.closeAria}>
        <SheetHeader><SheetTitle>{copy.evidenceDrawer.title}: {title}</SheetTitle><SheetDescription>{copy.evidenceDrawer.subtitle}</SheetDescription></SheetHeader>
        <div style={{ padding: "0 1rem 1rem" }}>
          {refs.length === 0 ? <p className="ctr-small">{copy.evidenceDrawer.empty}</p> : null}
          {refs.map((r) => {
            const href = evidenceHref(r);
            return (
              <div key={`${r.kind}:${r.id}`} className="ctr-evrow">
                <span className="ctr-tag" style={{ width: "fit-content" }}>{copy.evidenceDrawer.kinds[r.kind]}</span>
                <strong className="ctr-wrap">{r.label}</strong>
                {href ? <Link className="ctr-btn is-ghost" style={{ width: "fit-content" }} href={href}>{copy.evidenceDrawer.open}</Link>
                  : r.kind === "certification" || r.kind === "profile" ? <button type="button" className="ctr-btn is-ghost" style={{ width: "fit-content" }} onClick={() => { onOpenChange(false); onOpenCompliance(); }}>{copy.evidenceDrawer.open}</button> : null}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function IndicatorCard({ ind, copy, onEvidence }: { ind: Indicator; copy: Copy; onEvidence: (title: string, refs: EvidenceRef[]) => void }) {
  const key = ind.key as IndicatorKey;
  const text = copy.performance.indicators[key];
  const empty = ind.status === "INSUFFICIENT_EVIDENCE";
  const value = ind.value === null ? "—" : ind.unit === "percent" ? percent(ind.value) : String(ind.value);
  const params = Object.fromEntries(Object.entries(ind.inputs).filter(([, v]) => typeof v === "number" || typeof v === "string")) as Record<string, string | number>;
  return (
    <article className={empty ? "ctr-ind is-empty" : "ctr-ind"} aria-label={text?.name ?? ind.key}>
      <h3>
        <span>{text?.name ?? ind.key}</span>
        <Popover>
          <PopoverTrigger asChild><button type="button" className="ctr-info-btn" aria-label={`${copy.performance.howCalculated} ${text?.name ?? ""}`}><InfoIcon aria-hidden="true" width={16} height={16} /></button></PopoverTrigger>
          <PopoverContent align="end" className="w-72"><p className="ctr-small"><strong>{copy.performance.howCalculated}</strong></p><p className="ctr-small">{text?.formula}</p></PopoverContent>
        </Popover>
      </h3>
      <p className="ctr-ind-value">{empty ? copy.performance.noEvidence : value}</p>
      {ind.unit === "percent" ? <div className="ctr-ind-bar" role="img" aria-label={empty ? copy.performance.noEvidence : value}><i style={{ width: `${empty ? 0 : Math.min(100, ind.value ?? 0)}%` }} /></div> : null}
      <p className="ctr-small">
        {empty ? fill(copy.performance.needs, { n: ind.minSample, m: ind.sampleSize }) : text ? fill(text.detail, params) : ""}
      </p>
      <div className="ctr-row">
        <span className="ctr-tag">{fill(copy.performance.sample, { n: ind.sampleSize })}</span>
        {ind.key === "inspectionOutcomeRate" ? <span className="ctr-tag">{copy.performance.coarse}</span> : null}
        {ind.key === "unverifiedClaims" ? <span className="ctr-tag">{copy.performance.claimedLabel}</span> : null}
        {ind.evidence.length ? <button type="button" className="ctr-btn is-ghost" onClick={() => onEvidence(text?.name ?? ind.key, ind.evidence)}>{copy.performance.seeEvidence} ({ind.evidence.length})</button> : null}
      </div>
    </article>
  );
}

const W = 320, H = 120, PAD = 22;

/** Plain SVG, drawn only when there are at least 3 real points. Each bar is one completed project's delay in days. */
function DelayBars({ points, copy }: { points: Performance["series"]["delay"]; copy: Copy }) {
  const max = Math.max(1, ...points.map((p) => p.delayDays));
  const bw = (W - PAD * 2) / points.length;
  return (
    <svg className="ctr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={fill(copy.performance.charts.delayAria, { n: points.length })}>
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" opacity="0.3" />
      {points.map((p, i) => {
        const h = ((H - PAD * 2) * p.delayDays) / max;
        return (
          <g key={`${p.projectCode}:${i}`}>
            <rect x={PAD + i * bw + 4} y={H - PAD - h} width={Math.max(4, bw - 8)} height={Math.max(h, 1)} rx="2" fill="currentColor" opacity={p.delayDays === 0 ? 0.25 : 0.85}><title>{`${p.projectCode}: ${fill(copy.performance.charts.daysLabel, { n: p.delayDays })}`}</title></rect>
            <text x={PAD + i * bw + bw / 2} y={H - 6} textAnchor="middle">{p.delayDays}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Running on-time share after each completed project, in finish order. */
function AdherenceLine({ points, copy }: { points: Performance["series"]["delay"]; copy: Copy }) {
  const run = points.map((_, i) => (points.slice(0, i + 1).filter((p) => p.delayDays === 0).length / (i + 1)) * 100);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, run.length - 1);
  const y = (v: number) => H - PAD - ((H - PAD * 2) * v) / 100;
  return (
    <svg className="ctr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={copy.performance.charts.scheduleAria}>
      <line x1={PAD} y1={y(100)} x2={W - PAD} y2={y(100)} stroke="currentColor" opacity="0.15" /><line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="currentColor" opacity="0.3" />
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={run.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      {run.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="currentColor"><title>{`${points[i]!.projectCode}: ${percent(Math.round(v * 10) / 10)}`}</title></circle>)}
      <text x={2} y={y(100) + 4}>100%</text><text x={2} y={y(0)}>0%</text>
    </svg>
  );
}

export function PerformancePanel({ perf, copy, locale, onOpenCompliance }: { perf: Performance; copy: Copy; locale: AuthLocale; onOpenCompliance: () => void }) {
  const [drawer, setDrawer] = useState<{ title: string; refs: EvidenceRef[] } | null>(null);
  const series = perf.series.delay;
  const bandLabel = perf.band;
  return (
    <div className="ctr">
      <section className="sp-surface ctr-panel" aria-label={copy.performance.title}>
        <h2>{copy.performance.title}</h2>
        <p className="ctr-small">{copy.performance.evidenceNote}</p>
        <div className="ctr-row" style={{ gap: "1.5rem" }}>
          <div><p className="ctr-label">{copy.evidence.label}</p><EvidenceMeter level={perf.evidenceLevel} copy={copy} /><p className="ctr-small">{fill(copy.evidence.based, { projects: perf.sample.projects, milestones: perf.sample.milestones })}</p></div>
          <div><p className="ctr-label">{copy.band.label}</p><BandChip band={perf.band} copy={copy} /></div>
        </div>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{copy.band.why}</summary>
          <p className="ctr-small">{copy.band.rule}</p>
          {bandLabel === "NOT_ENOUGH_EVIDENCE" ? <p className="ctr-small">{copy.band.hidden}</p> : null}
          {perf.bandBasis.length ? (
            <>
              <p className="ctr-label">{copy.band.basis}</p>
              <ul className="ctr-small">{perf.bandBasis.map((b) => <li key={b.key}>{copy.performance.indicators[b.key as IndicatorKey]?.name ?? b.key}: <strong className="ctr-num">{percent(b.value)}</strong></li>)}</ul>
            </>
          ) : null}
        </details>
        <p className="ctr-small">{copy.performance.ruleVersion.replace("{v}", perf.ruleVersion)} · {fill(copy.performance.generated, { when: formatDate(perf.generatedAt, locale) })} · {copy.performance.scoped}</p>
      </section>

      <div className="ctr-ind-grid">{perf.indicators.map((i) => <IndicatorCard key={i.key} ind={i} copy={copy} onEvidence={(title, refs) => setDrawer({ title, refs })} />)}</div>

      <section className="sp-surface ctr-panel" aria-label={copy.performance.charts.delayTitle}>
        <div className="ctr-cols">
          <div><h3>{copy.performance.charts.delayTitle}</h3>{series.length >= 3 ? <DelayBars points={series} copy={copy} /> : <p className="ctr-small">{copy.performance.charts.needMore}</p>}</div>
          <div><h3>{copy.performance.charts.scheduleTitle}</h3>{series.length >= 3 ? <AdherenceLine points={series} copy={copy} /> : <p className="ctr-small">{copy.performance.charts.needMore}</p>}</div>
        </div>
      </section>

      {perf.deferred.length ? (<section className="ctr-deferred" aria-label={copy.performance.deferredTitle}>
        <p style={{ gridColumn: "1 / -1", fontWeight: 700 }}>{copy.performance.deferredTitle}</p>
        {perf.deferred.map((d) => <p key={d.key}>{copy.performance.deferred[d.key as keyof Copy["performance"]["deferred"]] ?? d.key}</p>)}
      </section>) : null}

      <EvidenceDrawer open={drawer !== null} onOpenChange={(o) => { if (!o) setDrawer(null); }} title={drawer?.title ?? ""} refs={drawer?.refs ?? []} copy={copy} onOpenCompliance={onOpenCompliance} />
    </div>
  );
}

export function FlagsPanel({ flags, copy, locale, onOpenCompliance }: { flags: RiskFlag[]; copy: Copy; locale: AuthLocale; onOpenCompliance: () => void }) {
  const [drawer, setDrawer] = useState<RiskFlag | null>(null);
  const label = (code: string) => copy.flags.codes[code as keyof Copy["flags"]["codes"]];
  return (
    <section className="sp-surface ctr-panel" aria-label={copy.flags.title}>
      <h2>{copy.flags.title}</h2>
      {flags.length === 0 ? <p className="ctr-small">{copy.flags.none}</p> : null}
      {flags.map((f) => {
        const t = label(f.code);
        const reason = t ? fill(t.reason, { ...f.params }) : f.reason;
        return (
          <article key={f.code} className="ctr-flag" data-severity={f.severity}>
            <div className="ctr-flag-head"><SeverityBadge severity={f.severity} copy={copy} /><span>{t?.label ?? f.code}</span></div>
            <p className="ctr-small" style={{ color: "var(--infra-text)" }}>{reason}</p>
            <div className="ctr-row">
              {f.since ? <span className="ctr-small">{fill(copy.flags.since, { date: formatDate(f.since, locale) })}</span> : null}
              <button type="button" className="ctr-btn is-ghost" onClick={() => setDrawer(f)}>{copy.flags.evidence} ({f.evidence.length})</button>
            </div>
          </article>
        );
      })}
      <EvidenceDrawer open={drawer !== null} onOpenChange={(o) => { if (!o) setDrawer(null); }} title={drawer ? label(drawer.code)?.label ?? drawer.code : ""} refs={drawer?.evidence ?? []} copy={copy} onOpenCompliance={onOpenCompliance} />
    </section>
  );
}
