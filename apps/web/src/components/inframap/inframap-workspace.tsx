"use client";

import "@/styles/mission-control-roadsync.css";
import "@/styles/mission-control-inframap.css";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrosshairIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { useRoadsyncKeys } from "@/components/roadsync/resolution-tab";
import { StatusChip } from "@/components/site-plan/site-plan";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fetchLayer } from "@/lib/inframap/inframap-api";
import { getInframapCopy, type InframapCopy } from "@/lib/inframap/inframap-copy";
import {
  bboxParam, LAYER_KEYS, PROJECT_STATUS_COLOR, summarize,
  type Bbox, type LayerData, type LayerKey, type MapFeature,
} from "@/lib/inframap/inframap";
import { BAND_COLOR, BANDS_ASC, fmt, type Band } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { getResolutionCopy } from "@/lib/roadsync/resolution-copy";
import { getWorkRequestCopy } from "@/lib/roadsync/work-request-copy";
import { WORK_STATUS_COLOR } from "@/components/roadsync/work-map";

import { InframapMap, type Selection } from "./inframap-map";

const VIEWPORT_DEBOUNCE_MS = 400;
const LIST_LIMIT = 30;

function useLayerQuery(layer: LayerKey, bbox: Bbox | null, enabled: boolean) {
  const keys = useRoadsyncKeys();
  return useQuery({
    queryKey: keys.key("inframap", `${layer}:${bbox ? bboxParam(bbox) : "none"}`),
    queryFn: ({ signal }) => fetchLayer(layer, bbox as Bbox, signal),
    enabled: Boolean(keys.userId) && Boolean(bbox) && enabled,
    // The previous viewport's features stay on screen until the new answer arrives; a stale answer never replaces a newer one.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}

export function InframapWorkspace() {
  const [locale] = useWorkspaceLocale();
  const copy = getInframapCopy(locale);
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>({ projects: true, roadworks: true, conflicts: true });
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);

  // Debounced viewport: only the last pan or zoom in a burst triggers a fetch.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onViewport = useCallback((next: Bbox) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBbox(next), VIEWPORT_DEBOUNCE_MS);
  }, []);

  const projects = useLayerQuery("projects", bbox, visible.projects);
  const roadworks = useLayerQuery("roadworks", bbox, visible.roadworks);
  const conflicts = useLayerQuery("conflicts", bbox, visible.conflicts);
  const queries = { projects, roadworks, conflicts };
  const data = useMemo(() => ({ projects: projects.data, roadworks: roadworks.data, conflicts: conflicts.data }), [projects.data, roadworks.data, conflicts.data]);

  const anyVisible = LAYER_KEYS.some((k) => visible[k]);
  const settled = bbox !== null && LAYER_KEYS.every((k) => !visible[k] || (!queries[k].isFetching && (queries[k].data !== undefined || queries[k].isError)));
  const total = LAYER_KEYS.reduce((n, k) => n + (visible[k] ? (data[k]?.features.length ?? 0) : 0), 0);
  const allEmpty = settled && anyVisible && total === 0 && LAYER_KEYS.every((k) => !visible[k] || !queries[k].isError);

  const picked = selected ? data[selected.layer]?.features.find((f) => f.properties.id === selected.id) : undefined;

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <div className="im">
        <p className="rs-help">{copy.demoNote}</p>
        <div className="im-bar" role="group" aria-label={copy.controls.heading}>
          {LAYER_KEYS.map((k) => (
            <LayerToggle key={k} layer={k} copy={copy} on={visible[k]} onToggle={() => setVisible((v) => ({ ...v, [k]: !v[k] }))} q={queries[k]} />
          ))}
          <button type="button" className="rs-btn" onClick={() => setResetKey((n) => n + 1)}><CrosshairIcon aria-hidden="true" />{copy.controls.reset}</button>
        </div>
        {!anyVisible ? <p className="im-note" role="status">{copy.states.nothingOn}</p> : allEmpty ? <p className="im-note" role="status">{copy.states.allEmpty}</p> : null}
        <div className="im-grid">
          <div className="im-stage">
            {mapFailed
              ? <div className="im-failed" role="alert"><p>{copy.states.mapFailed}</p></div>
              : <InframapMap data={data} visible={visible} selected={selected} resetKey={resetKey} label={copy.mapLabel} onViewport={onViewport} onSelect={setSelected} onFailed={() => setMapFailed(true)} />}
            <Legend copy={copy} locale={locale} />
          </div>
          <aside className="im-panel" aria-label={copy.panel.heading}>
            <h2 className="im-h">{copy.panel.heading}</h2>
            {picked && selected ? <Details layer={selected.layer} feature={picked} copy={copy} onClear={() => setSelected(null)} /> : <p className="rs-help">{copy.panel.none}</p>}
            <InView data={data} visible={visible} selected={selected} onSelect={setSelected} copy={copy} />
          </aside>
        </div>
      </div>
    </StaffWorkspaceShell>
  );
}

function LayerToggle({ layer, copy, on, onToggle, q }: { layer: LayerKey; copy: InframapCopy; on: boolean; onToggle: () => void; q: { data: LayerData | undefined; isFetching: boolean; isError: boolean; error: unknown; refetch: () => unknown } }) {
  const status = q.error instanceof ApiError ? q.error.status : 0;
  let note: string | null = null;
  if (on) {
    if (q.isError) note = status === 403 || status === 404 ? copy.states.forbidden : copy.states.error;
    else if (q.data === undefined) note = copy.states.loading;
    else if (q.data.truncated) note = fmt(copy.states.truncated, { n: q.data.features.length });
    else note = q.data.features.length === 1 ? copy.states.countOne : fmt(copy.states.count, { n: q.data.features.length });
  }
  return (
    <span className="im-toggle" data-layer={layer} data-on={on}>
      <button type="button" className="rs-btn" aria-pressed={on} onClick={onToggle} title={copy.layerHelp[layer]}>
        <span className="im-swatch" aria-hidden="true" />{copy.layers[layer]}
      </button>
      {note ? <span className="im-toggle-note" role={q.isError ? "alert" : "status"}>{note}</span> : null}
      {on && q.isError && status !== 403 && status !== 404 ? <button type="button" className="rs-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.controls.retry}</button> : null}
    </span>
  );
}

function Legend({ copy, locale }: { copy: InframapCopy; locale: "en" | "si" | "ta" }) {
  const assess = getAssessmentCopy(locale);
  const work = getWorkRequestCopy(locale).list;
  return (
    <details className="im-legend">
      <summary>{copy.controls.legend}</summary>
      <p className="im-legend-h">{copy.layers.projects}</p>
      <ul>{["ACTIVE", "APPROVED", "DELAYED", "ON_HOLD", "COMPLETED"].map((s) => <li key={s}><i style={{ background: PROJECT_STATUS_COLOR[s] }} aria-hidden="true" />{s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</li>)}</ul>
      <p className="im-legend-h">{copy.layers.roadworks}</p>
      <ul>{["DRAFT", "SUBMITTED", "APPROVED", "ACTIVE", "COMPLETED"].map((s) => <li key={s}><i style={{ background: WORK_STATUS_COLOR[s] }} aria-hidden="true" />{work.statuses[s]}</li>)}</ul>
      <p className="im-legend-h">{copy.layers.conflicts}</p>
      <ul>{BANDS_ASC.map((b) => <li key={b}><i className="im-dot" style={{ background: BAND_COLOR[b] }} aria-hidden="true" />{assess.bands[b]}</li>)}</ul>
      <p className="rs-help">{copy.controls.closedNote}</p>
    </details>
  );
}

const dateFmt = (locale: string, iso: unknown) => (typeof iso === "string" && iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(iso)) : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

function Details({ layer, feature, copy, onClear }: { layer: LayerKey; feature: MapFeature; copy: InframapCopy; onClear: () => void }) {
  const [locale] = useWorkspaceLocale();
  const p = feature.properties;
  const info = summarize(layer, p);
  const work = getWorkRequestCopy(locale).list;
  const f = copy.fields;
  const rows: [string, string | null][] = [];
  let chip: React.ReactNode = null;
  if (layer === "projects") {
    chip = <StatusChip domain="project" status={str(p.status) ?? "DRAFT"} />;
    rows.push([f.code, str(p.projectCode)], [f.type, str(p.projectType)?.replace(/_/g, " ").toLowerCase() ?? null], [f.agency, str(p.agencyName)], [f.dates, [dateFmt(locale, p.startDate), dateFmt(locale, p.plannedEndDate)].filter(Boolean).join(" → ") || null]);
  } else if (layer === "roadworks") {
    chip = <StatusChip domain="work" status={str(p.status) ?? "DRAFT"} label={work.statuses[str(p.status) ?? ""]} />;
    rows.push([f.workType, work.workTypes[str(p.workType) ?? ""] ?? null], [f.project, [str(p.projectCode), str(p.projectTitle)].filter(Boolean).join(" · ") || null], [f.agency, str(p.agencyName)], [f.priority, work.priorities[str(p.priority) ?? ""] ?? null], [f.dates, [dateFmt(locale, p.plannedStart), dateFmt(locale, p.plannedEnd)].filter(Boolean).join(" → ") || null]);
  } else {
    const conflict = getConflictCopy(locale);
    const band = str(p.band) as Band | null;
    chip = <span className="rs-nb-chip">{conflict.status[str(p.status) ?? ""] ?? str(p.status)}</span>;
    rows.push([f.band, band ? getAssessmentCopy(locale).bands[band] : null], [f.score, typeof p.score === "number" ? String(p.score) : null], [f.resolution, str(p.resolutionState) ? (getResolutionCopy(locale).status[str(p.resolutionState) as string] ?? str(p.resolutionState)) : null], [f.window, [dateFmt(locale, p.overlapStart), dateFmt(locale, p.overlapEnd)].filter(Boolean).join(" → ") || null]);
  }
  return (
    <section className="im-details">
      <div className="im-details-top"><strong>{info?.title}</strong>{chip}</div>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? copy.noValue}</dd></div>)}</dl>
      <div className="im-details-actions">
        {info ? <Link className="rs-btn is-primary" href={info.href}><ExternalLinkIcon aria-hidden="true" />{copy.panel.open[layer]}</Link> : null}
        <button type="button" className="rs-btn" onClick={onClear}>{copy.panel.clear}</button>
      </div>
    </section>
  );
}

/** Keyboard and screen-reader path to every feature the map shows: the same features, as buttons. */
function InView({ data, visible, selected, onSelect, copy }: { data: Partial<Record<LayerKey, LayerData>>; visible: Record<LayerKey, boolean>; selected: Selection | null; onSelect: (s: Selection) => void; copy: InframapCopy }) {
  const groups = LAYER_KEYS.filter((k) => visible[k] && (data[k]?.features.length ?? 0) > 0);
  return (
    <section className="im-list" aria-label={copy.panel.inView}>
      <h3 className="im-h">{copy.panel.inView}</h3>
      {groups.length === 0 ? <p className="rs-help">{copy.panel.inViewEmpty}</p> : groups.map((k) => {
        const features = data[k]!.features;
        return (
          <div key={k}>
            <p className="im-legend-h">{copy.layers[k]}</p>
            <ul>
              {features.slice(0, LIST_LIMIT).map((feat) => {
                const info = summarize(k, feat.properties);
                if (!info) return null;
                const on = selected?.layer === k && selected.id === info.id;
                return <li key={info.id}><button type="button" className="im-item" aria-pressed={on} onClick={() => onSelect({ layer: k, id: info.id })}><span>{info.title}</span>{info.subtitle ? <small>{info.subtitle}</small> : null}</button></li>;
              })}
            </ul>
            {features.length > LIST_LIMIT ? <p className="rs-help">{fmt(copy.panel.more, { n: features.length - LIST_LIMIT })}</p> : null}
          </div>
        );
      })}
    </section>
  );
}
