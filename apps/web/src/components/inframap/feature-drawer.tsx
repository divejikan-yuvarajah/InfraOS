"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, CrosshairIcon, ExternalLinkIcon, LockIcon, TargetIcon, UnlockIcon, XIcon } from "lucide-react";

import { StatusChip } from "@/components/site-plan/site-plan";
import { getAssetCopy } from "@/lib/assets/messages";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import type { ExposureData, FeatureDetail, NearbyData, RelatedRef } from "@/lib/inframap/inframap-api";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import { summarize, type LayerKey, type MapFeature, CLOSED_CONFLICT_STATUSES } from "@/lib/inframap/inframap";
import { placeName } from "@/lib/inframap/places-copy";
import { fmt, type Band } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { getResolutionCopy } from "@/lib/roadsync/resolution-copy";
import { getWorkRequestCopy } from "@/lib/roadsync/work-request-copy";

import { AssetOverview, ExposureTab, NearbyTab, ProvenanceChip, RiskOverview, SourceTab, type AsyncState, type Ref } from "./inframap-context-panels";
import { valueLabel } from "./inframap-labels";
import type { EvidenceState } from "./inframap-parts";

export type DrawerTab = "overview" | "related" | "exposure" | "nearby" | "source";
export type DetailState = { status: "loading" | "ready" | "unavailable" | "error"; data: FeatureDetail | null };

type Props = {
  layer: LayerKey; id: string; placeholder: MapFeature | undefined; detail: DetailState; evidence: EvidenceState; exposure: AsyncState<ExposureData>; nearby: AsyncState<NearbyData>;
  canExposure: boolean; tab: DrawerTab; onTab: (t: DrawerTab) => void; expTab: string; onExpTab: (t: string) => void; highlight: boolean; onHighlight: () => void;
  radius: number; onRadius: (m: number) => void; onSelectRef: (r: Ref) => void; back: { title: string } | null; onBack: () => void; onClose: () => void; onRetry: () => void;
  onZoom: () => void; onCopyLink: () => void; locked: boolean; onLock: () => void; nav: { index: number; count: number; onPrev: () => void; onNext: () => void } | null;
  copy: InframapCopy; c3: B3Copy; onWidth?: (w: number) => void; width?: number;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const dateFmt = (locale: string, iso: unknown) => (typeof iso === "string" && iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(iso)) : null);
const range = (locale: string, a: unknown, b: unknown) => [dateFmt(locale, a), dateFmt(locale, b)].filter(Boolean).join(" → ") || null;
const NEW_KINDS: LayerKey[] = ["assets", "utilities", "risks"];

/** Keyboard- and pointer-resizable divider (340 to 520 px). */
export function ResizeHandle({ width, onWidth, label }: { width: number; onWidth: (w: number) => void; label: string }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const clamp = (w: number) => Math.max(340, Math.min(520, Math.round(w)));
  return (
    <div
      className="im-resize" role="separator" aria-orientation="vertical" aria-label={label} aria-valuemin={340} aria-valuemax={520} aria-valuenow={width} tabIndex={0}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: width }; }}
      onPointerMove={(e) => { if (start.current) onWidth(clamp(start.current.w + (start.current.x - e.clientX))); }}
      onPointerUp={() => { start.current = null; }}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); onWidth(clamp(width + 16)); } else if (e.key === "ArrowRight") { e.preventDefault(); onWidth(clamp(width - 16)); } }}
    />
  );
}

/** One reusable drawer for all six layers. It reads the detail endpoint, so a record outside the loaded view still opens. */
export function FeatureDrawer(p: Props) {
  const { layer, copy, c3, tab, detail } = p;
  const [locale] = useWorkspaceLocale();
  const props = detail.data?.properties ?? p.placeholder?.properties ?? {};
  const info = summarize(layer, props);
  const d = c3.dr;
  const detailState: AsyncState<FeatureDetail> = { status: detail.status === "ready" ? "ready" : detail.status === "loading" ? "loading" : "error", data: detail.data };

  if (detail.status === "unavailable") {
    return <section className="im-details" aria-label={d.unavailable}><div className="im-details-top"><strong>{d.unavailable}</strong><button type="button" className="im-x" aria-label={copy.more.close} onClick={p.onClose}><XIcon aria-hidden="true" /></button></div>{p.back ? <button type="button" className="rs-btn im-back" onClick={p.onBack}><ArrowLeftIcon aria-hidden="true" />{fmt(copy.nearby.back, { title: p.back.title })}</button> : null}</section>;
  }

  const work = getWorkRequestCopy(locale).list;
  const f = copy.fields;
  const rows: [string, string | null][] = [];
  let chip: React.ReactNode = null;
  let extra: React.ReactNode = null;
  if (layer === "projects") {
    chip = <StatusChip domain="project" status={str(props.status) ?? "DRAFT"} label={valueLabel("projects", str(props.status) ?? "", copy, locale)} />;
    rows.push([f.code, str(props.projectCode)], [f.type, str(props.projectType)?.replace(/_/g, " ").toLowerCase() ?? null], [f.agency, str(props.agencyName)], [f.district, [str(props.district) ? placeName(String(props.district), locale) : null, str(props.province) ? placeName(String(props.province), locale) : null].filter(Boolean).join(", ") || null], [f.dates, range(locale, props.startDate, props.plannedEndDate)]);
  } else if (layer === "roadworks") {
    const late = props.isOverdue === true;
    chip = <><StatusChip domain="work" status={str(props.status) ?? "DRAFT"} label={work.statuses[str(props.status) ?? ""]} />{late ? <span className="im-overdue" title={copy.roadwork.overdueNote}>{copy.roadwork.overdue}</span> : null}</>;
    rows.push([f.workType, work.workTypes[str(props.workType) ?? ""] ?? null], [f.project, [str(props.projectCode), str(props.projectTitle)].filter(Boolean).join(" · ") || null], [f.agency, str(props.agencyName)], [f.priority, work.priorities[str(props.priority) ?? ""] ?? null], [f.dates, range(locale, props.plannedStart, props.plannedEnd)]);
    if (late) extra = <p className="rs-help">{copy.roadwork.overdueNote}</p>;
  } else if (layer === "conflicts") {
    const conflict = getConflictCopy(locale);
    const band = str(props.band) as Band | null;
    const closed = (CLOSED_CONFLICT_STATUSES as readonly string[]).includes(str(props.status) ?? "");
    chip = <span className="rs-nb-chip">{conflict.status[str(props.status) ?? ""] ?? str(props.status)}</span>;
    rows.push([f.band, band ? getAssessmentCopy(locale).bands[band] : null], [f.score, typeof props.score === "number" ? String(props.score) : null], [f.district, str(props.district) ? placeName(String(props.district), locale) : null], [f.resolution, str(props.resolutionState) ? (getResolutionCopy(locale).status[str(props.resolutionState) as string] ?? str(props.resolutionState)) : null], [f.window, range(locale, props.overlapStart, props.overlapEnd)]);
    const parties = (p.evidence.data?.features ?? []).filter((x) => x.properties.feature === "party");
    extra = (
      <div className="im-parties" aria-live="polite">
        <p className="im-legend-h">{copy.conflict.parties}</p>
        {p.evidence.status === "loading" ? <p className="rs-help">{copy.conflict.loadingEvidence}</p> : null}
        {p.evidence.status === "error" ? <p className="rs-help" role="alert">{copy.conflict.evidenceError}</p> : null}
        {p.evidence.status === "ready" && parties.length === 0 ? <p className="rs-help">{copy.conflict.noGeometry}</p> : null}
        {parties.map((x) => {
          const side = x.properties.side === "b" ? "b" : "a";
          return (
            <div key={side} className="im-party" data-side={side}>
              <i className="im-sw" data-shape={side === "a" ? "line" : "dash"} style={{ ["--c" as string]: side === "a" ? "#0369a1" : "#a21caf" }} aria-hidden="true" />
              <div><strong>{side === "a" ? copy.conflict.sideA : copy.conflict.sideB}</strong><span>{[str(x.properties.title), str(x.properties.agencyName)].filter(Boolean).join(" · ") || copy.noValue}</span></div>
            </div>
          );
        })}
        <p className="rs-help">{closed ? copy.conflict.closedNote : copy.conflict.openNote}</p>
      </div>
    );
  } else if (layer === "assets" || layer === "utilities") {
    chip = <span className="rs-nb-chip">{valueLabel("assets", str(props.condition) ?? "UNKNOWN", copy, locale)}</span>;
    rows.push([f.type, valueLabel(layer, str(props.assetType) ?? "", copy, locale)], [f.agency, str(props.agencyName)], [f.district, [str(props.district) ? placeName(String(props.district), locale) : null, str(props.province) ? placeName(String(props.province), locale) : null].filter(Boolean).join(", ") || null], [f.tier, str(props.tier) === "FULL" ? null : copy.tier.awareness]);
    extra = (
      <>
        <AssetOverview properties={props} detail={detailState} copy={copy} locale={locale} />
        {props.tier === "FULL" ? <Link className="rs-btn" href={`/assets/${p.id}`}><ExternalLinkIcon aria-hidden="true" />{getAssetCopy(locale).passport.title}</Link> : null}
      </>
    );
  } else {
    const project = props.kind === "project";
    chip = <span className="rs-nb-chip">{project ? valueLabel("risks", `band:${String(props.riskBand)}`, copy, locale) : valueLabel("risks", str(props.level) ?? "", copy, locale)}</span>;
    if (project) rows.push([f.code, str(props.projectCode)]); else rows.push([f.agency, str(props.agencyName)]);
    extra = <RiskOverview properties={props} detail={detailState} copy={copy} locale={locale} />;
  }

  const related = detail.data?.related ?? [];
  const showSource = NEW_KINDS.includes(layer) || Boolean(detail.data?.provenance);
  const tabs: DrawerTab[] = ["overview", "related", ...(p.canExposure ? ["exposure" as const] : []), "nearby", ...(showSource ? ["source" as const] : [])];
  const current = tabs.includes(tab) ? tab : "overview";
  const record = detail.data?.links?.record ?? null;
  const roadsyncHref = layer === "roadworks" || layer === "conflicts" ? record : null;
  const hasGeometry = detail.data ? detail.data.actions?.canZoom !== false : true;
  const ex = detail.data?.exposure;

  return (
    <section className="im-details" aria-label={info?.title} aria-busy={detail.status === "loading"}>
      {p.back ? <button type="button" className="rs-btn im-back" onClick={p.onBack}><ArrowLeftIcon aria-hidden="true" />{fmt(copy.nearby.back, { title: p.back.title })}</button> : null}
      <div className="im-details-top">
        <div className="im-title"><strong>{info?.title}</strong><small>{copy.layers[layer]} · {p.id.slice(-6)}</small></div>
        <div className="im-top-actions">
          {p.nav ? <><button type="button" className="im-x" aria-label={d.prev} onClick={p.nav.onPrev}><ChevronLeftIcon aria-hidden="true" /></button><small>{fmt(d.position, { i: p.nav.index + 1, n: p.nav.count })}</small><button type="button" className="im-x" aria-label={d.next} onClick={p.nav.onNext}><ChevronRightIcon aria-hidden="true" /></button></> : null}
          <button type="button" className="im-x" aria-pressed={p.locked} aria-label={p.locked ? d.unlock : d.lock} title={p.locked ? d.unlock : d.lock} onClick={p.onLock}>{p.locked ? <LockIcon aria-hidden="true" /> : <UnlockIcon aria-hidden="true" />}</button>
          <button type="button" className="im-x" aria-label={copy.more.close} onClick={p.onClose}><XIcon aria-hidden="true" /></button>
        </div>
      </div>
      <div className="im-chips">{chip}<ProvenanceChip kind={str(props.provenance)} copy={copy} /></div>
      {detail.status === "error" ? <p className="rs-help" role="alert">{c3.hl.error} <button type="button" className="rs-btn" onClick={p.onRetry}>{d.retry}</button></p> : null}
      {detail.status === "ready" && !hasGeometry ? <p className="im-tier" role="note">{d.noMapLocation}</p> : null}
      <div role="tablist" className="im-seg" aria-label={copy.panel.heading}>
        {tabs.map((t) => <button key={t} type="button" role="tab" aria-selected={t === current} className="im-seg-btn" onClick={() => p.onTab(t)}>{t === "related" ? d.related : copy.tabs[t]}</button>)}
      </div>
      <div className="im-tabpanel" key={`${layer}:${p.id}:${current}`}>
        {current === "overview" ? (
          <>
            {detail.status === "loading" && !p.placeholder ? <div className="im-skel" aria-busy="true"><span className="im-shimmer" /><span className="im-shimmer" /><span className="im-shimmer" /></div> : null}
            <dl>{rows.filter(([, v]) => v !== null).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            {ex ? <p className="im-exp-line">{ex.mode === "zones" ? (ex.zones ? fmt(ex.zones === 1 ? d.exposureOne : d.exposureLine, { n: ex.zones, level: valueLabel("risks", ex.worstLevel ?? "", copy, locale) }) : d.exposureNone) : fmt(d.exposureRecords, { n: (ex.projects ?? 0) + (ex.roadworks ?? 0) + (ex.assets ?? 0) + (ex.utilities ?? 0) })}</p> : null}
            {extra}
          </>
        ) : null}
        {current === "related" ? (
          related.length === 0 ? <p className="rs-help">{d.noRelated}</p> : (
            <ul className="im-rows">{related.map((r: RelatedRef) => (
              <li key={`${r.layer}${r.id}`}><button type="button" className="im-item" onClick={() => p.onSelectRef({ layer: r.layer, id: r.id, title: r.title, point: null })}><span>{r.title}</span><small>{d.relations[r.relation] ?? copy.layers[r.layer]}{r.status ? ` · ${r.status}` : ""}</small></button></li>
            ))}</ul>
          )
        ) : null}
        {current === "exposure" ? <ExposureTab state={p.exposure} tab={p.expTab} onTab={p.onExpTab} highlight={p.highlight} onHighlight={p.onHighlight} onSelectRef={p.onSelectRef} copy={copy} locale={locale} /> : null}
        {current === "nearby" ? <NearbyTab state={p.nearby} radius={p.radius} onRadius={p.onRadius} onSelectRef={p.onSelectRef} roadsyncHref={roadsyncHref} copy={copy} locale={locale} /> : null}
        {current === "source" ? <SourceTab properties={props} copy={copy} locale={locale} /> : null}
      </div>
      <div className="im-details-actions im-sticky">
        <button type="button" className="rs-btn" disabled={!hasGeometry} onClick={p.onZoom}><CrosshairIcon aria-hidden="true" />{d.zoomTo}</button>
        <button type="button" className="rs-btn" onClick={() => p.onTab("nearby")}><TargetIcon aria-hidden="true" />{copy.nearby.open}</button>
        <button type="button" className="rs-btn" onClick={p.onCopyLink}><CopyIcon aria-hidden="true" />{d.copyLink}</button>
        {record ? <Link className="rs-btn is-primary" href={record}><ExternalLinkIcon aria-hidden="true" />{d.openRecord}</Link> : null}
      </div>
    </section>
  );
}
