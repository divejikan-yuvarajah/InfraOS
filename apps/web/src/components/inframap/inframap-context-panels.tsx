"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ExternalLinkIcon, LockIcon } from "lucide-react";

import type { ExposureData, ExposureItem, FeatureDetail, NearbyData, NearbyItem } from "@/lib/inframap/inframap-api";
import { NEARBY_RADII } from "@/lib/inframap/inframap-api";
import type { LayerKey } from "@/lib/inframap/inframap";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import { CONDITION_COLOR, drawSprite, paintAsset, paintHatch, paintHexagon, paintRiskRing, UTILITY_COLOR } from "@/lib/inframap/map-icons";
import { fmt } from "@/lib/roadsync/assessment";

import { valueLabel } from "./inframap-labels";

type Locale = "en" | "si" | "ta";
export type AsyncState<T> = { status: "idle" | "loading" | "error" | "forbidden" | "ready"; data: T | null };
export type Ref = { layer: LayerKey; id: string; title: string; point: [number, number] | null };

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const day = (locale: string, iso: unknown) => (typeof iso === "string" && iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(iso)) : null);

/** Draws a map sprite into a small canvas, using the same paint functions as the map, so the legend cannot drift from it. */
export function SpriteSwatch({ sprite, size = 22 }: { sprite: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const [kind, a, b] = sprite.split(":");
    const paint = kind === "asset" ? paintAsset(a!, b!) : kind === "hatch" ? paintHatch(a!) : kind === "hex" ? paintHexagon(UTILITY_COLOR[a!] ?? "#64748b") : kind === "risk" ? paintRiskRing(a!) : null;
    if (ref.current && paint) drawSprite(ref.current, paint);
  }, [sprite]);
  return <canvas ref={ref} className="im-sprite" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 26, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? "#15803d" : pct >= 50 ? "#ca8a04" : pct >= 30 ? "#ea580c" : "#b91c1c";
  return (
    <figure className="im-gauge" aria-label={`${label}: ${pct}%`}>
      <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0b1f3a">{pct}</text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** Last inspection, today and next maintenance on one line; the span after a passed maintenance date is marked overdue. */
/** `late` comes from the server's attention rule (MAINTENANCE_OVERDUE), so the component stays pure. */
export function MaintenanceTimeline({ last, next, late, copy, locale }: { last: string | null; next: string | null; late: boolean; copy: InframapCopy; locale: Locale }) {
  const fmtDay = (v: string | null) => day(locale, v) ?? copy.noValue;
  return (
    <ol className="im-timeline" aria-label={copy.detail.timeline} data-late={late}>
      <li><b>{copy.detail.lastInspection}</b><span>{fmtDay(last)}</span></li>
      {late ? <li className="im-tl-late"><b>{copy.detail.nextMaintenance} · {copy.detail.overdue}</b><span>{fmtDay(next)}</span></li> : null}
      <li className="im-tl-today"><b>{copy.detail.today}</b><span>{day(locale, new Date().toISOString())}</span></li>
      {!late ? <li><b>{copy.detail.nextMaintenance}</b><span>{fmtDay(next)}</span></li> : null}
    </ol>
  );
}

export function ProvenanceChip({ kind, copy }: { kind: string | null; copy: InframapCopy }) {
  if (!kind) return null;
  return <span className="im-prov" data-kind={kind}>{copy.provenance[kind] ?? kind}</span>;
}

const pretty = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function AssetOverview({ properties, detail, copy, locale }: { properties: Record<string, unknown>; detail: AsyncState<FeatureDetail>; copy: InframapCopy; locale: Locale }) {
  const full = properties.tier === "FULL";
  const condition = str(properties.condition) ?? "UNKNOWN";
  const reasons = detail.data?.reasons ?? (Array.isArray(properties.attentionReasons) ? (properties.attentionReasons as string[]) : []);
  const health = typeof properties.healthScore === "number" ? properties.healthScore : null;
  return (
    <div className="im-asset">
      {properties.sensitivity === "RESTRICTED" ? <p className="im-tier"><LockIcon aria-hidden="true" />{copy.tier.restricted}</p> : null}
      {!full ? <p className="im-tier" role="note">{copy.tier.awareness}</p> : null}
      <div className="im-asset-top">
        {health !== null ? <Gauge value={health} label={copy.detail.health} /> : null}
        <div className="im-condition" style={{ ["--c" as string]: CONDITION_COLOR[condition] ?? "#64748b" }}><b>{valueLabel("assets", condition, copy, locale)}</b><small>{copy.fields.condition}</small></div>
      </div>
      {full ? <MaintenanceTimeline last={str(properties.lastInspectionAt)} next={str(properties.nextMaintenanceAt)} late={reasons.includes("MAINTENANCE_OVERDUE")} copy={copy} locale={locale} /> : null}
      {full && reasons.length > 0 ? <div><p className="im-legend-h">{copy.detail.reasons}</p><ul className="im-reasons">{reasons.map((r) => <li key={r}>{copy.reasons[r] ?? r}</li>)}</ul></div> : null}
      {full ? (
        <div>
          <p className="im-legend-h">{copy.detail.recent}</p>
          {detail.status === "loading" ? <p className="rs-help">{copy.detail.loading}</p> : null}
          {detail.status === "ready" && (detail.data?.maintenance ?? []).length === 0 ? <p className="rs-help">{copy.detail.noMaintenance}</p> : null}
          <ul className="im-maint">{(detail.data?.maintenance ?? []).map((m, i) => (
            <li key={i}><span>{pretty(m.maintenanceType)}</span><span className="rs-nb-chip">{pretty(m.status)}</span><small>{day(locale, m.completedDate ?? m.scheduledDate) ?? ""}</small></li>
          ))}</ul>
        </div>
      ) : null}
      {typeof properties.sourceProjectId === "string" && properties.sourceProjectTitle ? (
        <Link className="rs-btn" href={`/projects/${properties.sourceProjectId}/overview`}><ExternalLinkIcon aria-hidden="true" />{String(properties.sourceProjectTitle)}</Link>
      ) : null}
    </div>
  );
}

export function RiskOverview({ properties, detail, copy, locale }: { properties: Record<string, unknown>; detail: AsyncState<FeatureDetail>; copy: InframapCopy; locale: Locale }) {
  if (properties.kind === "project") {
    const top = (detail.data?.properties.topFactors as { category: string; score: number }[] | undefined) ?? [];
    return (
      <div className="im-asset">
        <div className="im-asset-top"><Gauge value={Number(properties.overallRisk) || 0} label={copy.detail.overall} /><div className="im-condition"><b>{valueLabel("risks", `band:${String(properties.riskBand)}`, copy, locale)}</b><small>{copy.detail.riskBand}</small></div></div>
        <p className="rs-help">{[fmt(copy.detail.assessed, { date: day(locale, properties.latestAssessedAt) ?? copy.noValue }), fmt(copy.detail.model, { v: String(properties.modelVersion ?? "") })].join(" · ")}</p>
        {top.length > 0 ? <div><p className="im-legend-h">{copy.detail.topFactors}</p><ul className="im-reasons">{top.map((f) => <li key={f.category}>{pretty(f.category)} · {f.score}</li>)}</ul></div> : null}
      </div>
    );
  }
  return (
    <div className="im-asset">
      <dl className="im-dl">
        <div><dt>{copy.detail.hazardType}</dt><dd>{valueLabel("risks", String(properties.hazardType), copy, locale)}</dd></div>
        <div><dt>{copy.detail.level}</dt><dd>{valueLabel("risks", String(properties.level), copy, locale)}</dd></div>
      </dl>
      {str(properties.description) ? <p className="rs-help">{String(properties.description)}</p> : null}
    </div>
  );
}

export function SourceTab({ properties, copy, locale }: { properties: Record<string, unknown>; copy: InframapCopy; locale: Locale }) {
  const source = properties.source as Record<string, unknown> | undefined;
  const url = str(source?.url);
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : null;
  return (
    <details className="im-source" open>
      <summary>{copy.detail.source}</summary>
      <ProvenanceChip kind={str(properties.provenance)} copy={copy} />
      {source ? (
        <dl className="im-dl">
          <div><dt>{copy.detail.organisation}</dt><dd>{str(source.organisation) ?? copy.noValue}</dd></div>
          <div><dt>{copy.detail.dataset}</dt><dd>{str(source.datasetName) ?? copy.noValue}</dd></div>
          <div><dt>{copy.detail.licence}</dt><dd>{str(source.licence) ?? copy.noValue}</dd></div>
          <div><dt>{copy.detail.dataDate}</dt><dd>{day(locale, source.dataDate) ?? copy.noValue}</dd></div>
          <div><dt>{copy.detail.retrieved}</dt><dd>{day(locale, source.retrievedAt) ?? copy.noValue}</dd></div>
          {safeUrl ? <div><dt>{copy.detail.url}</dt><dd><a href={safeUrl} target="_blank" rel="noopener noreferrer">{safeUrl}</a></dd></div> : null}
        </dl>
      ) : <p className="rs-help">{copy.provenance[str(properties.provenance) ?? ""] ?? copy.noValue}</p>}
    </details>
  );
}

const refOf = (layer: LayerKey, item: { id: string; point: [number, number] | null }, title: string): Ref => ({ layer, id: item.id, title, point: item.point });

export function ExposureTab({ state, tab, onTab, highlight, onHighlight, onSelectRef, copy, locale }: {
  state: AsyncState<ExposureData>; tab: string; onTab: (t: string) => void; highlight: boolean; onHighlight: () => void; onSelectRef: (r: Ref) => void; copy: InframapCopy; locale: Locale;
}) {
  const e = copy.exposure;
  if (state.status === "forbidden") return <p className="rs-help">{e.unavailable}</p>;
  if (state.status === "loading" || state.status === "idle") return <div className="im-skel" aria-busy="true"><p className="rs-help">{e.loading}</p></div>;
  if (state.status === "error" || !state.data) return <p className="rs-help" role="alert">{e.error}</p>;
  const data = state.data;
  return (
    <div className="im-exposure">
      {data.mode === "zones" ? (
        data.zones.length === 0 ? <p className="im-exp-none">{e.none}</p> : (
          <>
            <p className="im-exp-line"><b>{(data.zones.length === 1 ? e.intersectsOne : fmt(e.intersects, { n: data.zones.length })).replace("{level}", valueLabel("risks", data.worstLevel ?? "", copy, locale))}</b></p>
            <ul className="im-chips-list">{data.zones.map((z) => (
              <li key={z.id}>
                <button type="button" className="im-chip" onClick={() => onSelectRef(refOf("risks", z, z.name))}>{fmt(e.zoneLine, { name: z.name, level: valueLabel("risks", z.level, copy, locale), type: valueLabel("risks", z.hazardType, copy, locale) })}</button>
                <small>{fmt(e.source, { org: z.source.organisation, dataset: z.source.datasetName })}{z.source.dataDate ? ` · ${fmt(e.dataDate, { date: day(locale, z.source.dataDate) ?? "" })}` : ""}{z.isDemo ? ` · ${copy.provenance.DEMO}` : ""}</small>
              </li>
            ))}</ul>
          </>
        )
      ) : (
        <ExposedRecords data={data} tab={tab} onTab={onTab} highlight={highlight} onHighlight={onHighlight} onSelectRef={onSelectRef} copy={copy} />
      )}
      <p className="rs-help">{e.note}</p>
    </div>
  );
}

function ExposedRecords({ data, tab, onTab, highlight, onHighlight, onSelectRef, copy }: {
  data: Extract<ExposureData, { mode: "records" }>; tab: string; onTab: (t: string) => void; highlight: boolean; onHighlight: () => void; onSelectRef: (r: Ref) => void; copy: InframapCopy;
}) {
  const e = copy.exposure;
  const tabs = (["projects", "roadworks", "assets", "utilities"] as const).filter((k) => data.records[k]);
  const current = (tabs.includes(tab as never) ? tab : tabs[0]) as (typeof tabs)[number] | undefined;
  const bucket = current ? data.records[current] : null;
  const total = tabs.reduce((n, k) => n + (data.records[k]?.total ?? 0), 0);
  const hidden = data.records.utilities?.hidden ?? 0;
  const label = (item: ExposureItem) => item.title ?? item.name ?? item.workType?.replace(/_/g, " ").toLowerCase() ?? item.id;
  return (
    <>
      <div className="im-exp-top">
        <b>{e.exposedRecords}: {total}</b>
        <button type="button" className="rs-btn" aria-pressed={highlight} onClick={onHighlight} disabled={total === 0}>{highlight ? e.highlightOff : e.highlight}</button>
      </div>
      {total === 0 ? <p className="im-exp-none">{e.empty}</p> : (
        <>
          <div role="tablist" className="im-seg" aria-label={e.exposedRecords}>
            {tabs.map((k) => <button key={k} type="button" role="tab" aria-selected={k === current} className="im-seg-btn" onClick={() => onTab(k)}>{e[k]} · {data.records[k]!.total}</button>)}
          </div>
          <ul className="im-rows">{(bucket?.items ?? []).map((item) => (
            <li key={item.id}><button type="button" className="im-item" onClick={() => onSelectRef(refOf(item.layer, item, label(item)))}><span>{label(item)}</span>{item.isDemo ? <small>{copy.provenance.DEMO}</small> : <small>{item.status ?? item.assetType ?? ""}</small>}</button></li>
          ))}</ul>
          {bucket && bucket.total > bucket.items.length ? <p className="rs-help">{fmt(e.more, { n: bucket.total - bucket.items.length })}</p> : null}
        </>
      )}
      {hidden > 0 ? <p className="im-tier"><LockIcon aria-hidden="true" />{fmt(e.hiddenNote, { n: hidden })}</p> : null}
    </>
  );
}

export function NearbyTab({ state, radius, onRadius, onSelectRef, roadsyncHref, copy, locale }: {
  state: AsyncState<NearbyData>; radius: number; onRadius: (m: number) => void; onSelectRef: (r: Ref) => void; roadsyncHref: string | null; copy: InframapCopy; locale: Locale;
}) {
  const n = copy.nearby;
  const groups = (["assets", "utilities", "risks"] as const).map((k) => [k, state.data?.layers[k]] as const).filter(([, v]) => v);
  const any = groups.some(([, v]) => (v?.items.length ?? 0) > 0);
  return (
    <div className="im-nearby">
      <p className="im-tier" role="note">{n.banner}</p>
      <div role="radiogroup" className="im-seg" aria-label={n.radius}>
        {NEARBY_RADII.map((m) => <button key={m} type="button" role="radio" aria-checked={radius === m} className="im-seg-btn" onClick={() => onRadius(m)}>{fmt(n.metres, { m })}</button>)}
      </div>
      {state.status === "loading" || state.status === "idle" ? <div className="im-skel" aria-busy="true"><p className="rs-help">{n.loading}</p></div> : null}
      {state.status === "error" ? <p className="rs-help" role="alert">{n.error}</p> : null}
      {state.status === "ready" && groups.length === 0 ? <p className="rs-help">{n.noAccess}</p> : null}
      {state.status === "ready" && groups.length > 0 && !any ? <p className="im-exp-none">{fmt(n.none, { m: radius })}</p> : null}
      {groups.map(([k, bucket]) => (bucket?.items.length ?? 0) > 0 ? (
        <div key={k}>
          <p className="im-legend-h">{copy.layers[k]} · {bucket!.total}</p>
          <ul className="im-rows">{bucket!.items.map((item: NearbyItem) => (
            <li key={item.id}><button type="button" className="im-item" onClick={() => onSelectRef({ layer: k, id: item.id, title: item.name, point: item.point })}>
              <span>{item.name}</span><small>{[item.assetType ? valueLabel(k, item.assetType, copy, locale) : item.hazardType ? valueLabel(k, item.hazardType, copy, locale) : null, item.agencyName].filter(Boolean).join(" · ")}{item.isDemo ? ` · ${copy.provenance.DEMO}` : ""}</small>
            </button></li>
          ))}</ul>
        </div>
      ) : null)}
      {state.data && state.data.restrictedHidden > 0 ? <p className="im-tier"><LockIcon aria-hidden="true" />{fmt(n.hidden, { n: state.data.restrictedHidden })}</p> : null}
      <p className="rs-help">{n.approx}</p>
      {roadsyncHref ? <Link className="rs-btn" href={roadsyncHref}><ExternalLinkIcon aria-hidden="true" />{n.openRoadsync}</Link> : null}
    </div>
  );
}
