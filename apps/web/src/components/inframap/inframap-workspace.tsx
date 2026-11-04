"use client";

import "@/styles/mission-control-roadsync.css";
import "@/styles/mission-control-inframap.css";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CrosshairIcon, LayersIcon, LockIcon, MapPinOffIcon, MaximizeIcon, MinimizeIcon, RefreshCwIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { useRoadsyncKeys } from "@/components/roadsync/resolution-tab";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { bboxParam, LAYER_KEYS, NO_FILTERS, type Bbox, type Filters, type LayerData, type LayerKey } from "@/lib/inframap/inframap";
import { fetchConflictEvidence, fetchLayer, fetchLayers } from "@/lib/inframap/inframap-api";
import { getInframapCopy } from "@/lib/inframap/inframap-copy";
import { LAYER_DEFS } from "@/lib/inframap/layer-registry";
import type { Candidate } from "@/lib/inframap/selection-priority";
import { fmt } from "@/lib/roadsync/assessment";

import { HoverCard, Legend, OverlapChooser, QuickView, SearchBox, valueLabel, LegendShape, type EvidenceState } from "./inframap-parts";
import { InframapMap, type Hover, type Readout, type Selection } from "./inframap-map";

const VIEWPORT_DEBOUNCE_MS = 400;
/*
 * Freshness: the server is the source of truth and there are no websockets. Layer queries are fresh for 30 s, refetch on
 * window focus and reconnect, and poll every 60 s while the tab is visible. "Refresh" refetches everything on demand;
 * a changed geometry or status shows up on the next refetch.
 */
const STALE_MS = 30_000;
const POLL_MS = 60_000;

function useLayerQuery(layer: LayerKey, bbox: Bbox | null, filters: Filters[LayerKey], enabled: boolean) {
  const keys = useRoadsyncKeys();
  const filterKey = JSON.stringify(Object.entries(filters).filter(([, v]) => v).sort());
  return useQuery({
    queryKey: keys.key("inframap", `${layer}:${bbox ? bboxParam(bbox) : "none"}:${filterKey}`),
    queryFn: ({ signal }) => fetchLayer(layer, bbox as Bbox, filters, signal),
    enabled: Boolean(keys.userId) && Boolean(bbox) && enabled,
    // The previous viewport's features stay on screen until the new answer arrives; a stale answer never replaces a newer one.
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });
}

export function InframapWorkspace() {
  const [locale] = useWorkspaceLocale();
  const copy = getInframapCopy(locale);
  const keys = useRoadsyncKeys();
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>(() => Object.fromEntries(LAYER_DEFS.map((d) => [d.id, d.defaultVisible])) as Record<LayerKey, boolean>);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [chooser, setChooser] = useState<{ candidates: Candidate[]; at: { x: number; y: number } } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [readout, setReadout] = useState<Readout>({ zoom: 0, lng: null, lat: null });
  const [resetKey, setResetKey] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const body = useRef<HTMLDivElement>(null);

  // Debounced viewport: only the last pan or zoom in a burst triggers a fetch.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onViewport = useCallback((next: Bbox) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBbox(next), VIEWPORT_DEBOUNCE_MS);
  }, []);
  // Readout is throttled by the map; this keeps the latest values without re-rendering on every pixel.
  const onReadout = useCallback((next: Readout) => setReadout((prev) => ({ zoom: next.zoom, lng: next.lng ?? prev.lng, lat: next.lat ?? prev.lat })), []);

  // Layer availability comes from the server; a forbidden layer is never requested.
  const layersQ = useQuery({
    queryKey: keys.key("inframap", "layers"),
    queryFn: ({ signal }) => fetchLayers(signal),
    enabled: Boolean(keys.userId),
    staleTime: STALE_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const info = layersQ.data;
  const available = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, info?.layers.find((l) => l.id === k)?.available === true])) as Record<LayerKey, boolean>, [info]);
  const reason = (k: LayerKey) => info?.layers.find((l) => l.id === k)?.reason;
  const shown = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, visible[k] && available[k]])) as Record<LayerKey, boolean>, [visible, available]);

  const projects = useLayerQuery("projects", bbox, filters.projects, shown.projects);
  const roadworks = useLayerQuery("roadworks", bbox, filters.roadworks, shown.roadworks);
  const conflicts = useLayerQuery("conflicts", bbox, filters.conflicts, shown.conflicts);
  const queries = { projects, roadworks, conflicts };
  const data = useMemo(() => ({ projects: projects.data, roadworks: roadworks.data, conflicts: conflicts.data }) as Partial<Record<LayerKey, LayerData>>, [projects.data, roadworks.data, conflicts.data]);

  // One toast per layer on its first failure; the layer row keeps the persistent error and Retry.
  const toasted = useRef(new Set<LayerKey>());
  const copyRef = useRef(copy);
  useEffect(() => { copyRef.current = copy; });
  useEffect(() => {
    for (const k of LAYER_KEYS) {
      if (queries[k].isError && !toasted.current.has(k)) { toasted.current.add(k); toast.error(fmt(copyRef.current.more.firstError, { layer: copyRef.current.layers[k] })); }
      if (!queries[k].isError) toasted.current.delete(k);
    }
  }, [projects.isError, roadworks.isError, conflicts.isError]); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = selected ? data[selected.layer]?.features.find((f) => f.properties.id === selected.id) : undefined;
  // A selection whose feature left the loaded set (filter or viewport change) simply shows no quick view until it is back.

  const evidenceQ = useQuery({
    queryKey: keys.key("inframap", `evidence:${selected?.id ?? "none"}`),
    queryFn: ({ signal }) => fetchConflictEvidence(selected!.id, signal),
    enabled: Boolean(keys.userId) && selected?.layer === "conflicts",
    staleTime: STALE_MS,
    retry: false,
  });
  const evidence: EvidenceState = selected?.layer !== "conflicts" ? { status: "idle", data: null } : evidenceQ.isError ? { status: "error", data: null } : evidenceQ.data ? { status: "ready", data: evidenceQ.data } : { status: "loading", data: null };

  const select = useCallback((next: Selection | null, title?: string) => {
    setSelected(next);
    setChooser(null);
    setAnnounce(next && title ? fmt(copy.more.announce, { title }) : copy.more.cleared);
  }, [copy]);
  const onPick = useCallback((candidates: Candidate[], at: { x: number; y: number }) => {
    if (candidates.length === 0) { select(null); return; }
    if (candidates.length === 1) { select({ layer: candidates[0]!.layer, id: candidates[0]!.id }, candidates[0]!.title); return; }
    setChooser({ candidates, at });
  }, [select]);

  // ESC closes the chooser first, then the quick view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (chooser) setChooser(null);
      else if (selected) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooser, selected, select]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === body.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void body.current?.requestFullscreen?.().catch(() => undefined);
  };

  const refreshAll = () => { void layersQ.refetch(); for (const k of LAYER_KEYS) if (shown[k]) void queries[k].refetch(); if (selected?.layer === "conflicts") void evidenceQ.refetch(); };
  const updatedAt = Math.max(0, layersQ.dataUpdatedAt, ...LAYER_KEYS.map((k) => (shown[k] ? queries[k].dataUpdatedAt : 0)));
  const updatedText = updatedAt ? fmt(copy.toolbar.updated, { time: new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Asia/Colombo" }).format(updatedAt) }) : copy.toolbar.notYet;

  const setFilter = (layer: LayerKey, key: string, value: string) => setFilters((f) => ({ ...f, [layer]: { ...f[layer], [key]: f[layer][key] === value ? undefined : value } }));
  const anyFilter = LAYER_KEYS.some((k) => Object.values(filters[k]).some(Boolean));
  const anyShown = LAYER_KEYS.some((k) => shown[k]);
  const forbiddenAll = layersQ.isError && layersQ.error instanceof ApiError && (layersQ.error.status === 403 || layersQ.error.status === 401);

  const hoverFeature = hover ? data[hover.layer]?.features.find((f) => f.properties.id === hover.id) : undefined;
  const missing = info?.projectsWithoutLocation;

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <div className="im">
        <p className="rs-help">{copy.demoNote}</p>
        <div className="im-top">
          <button type="button" className="rs-btn im-panel-toggle" aria-expanded={panelOpen} aria-controls="im-side" onClick={() => setPanelOpen((o) => !o)}><LayersIcon aria-hidden="true" />{panelOpen ? copy.toolbar.hidePanel : copy.toolbar.showPanel}</button>
          <span className="im-fresh" role="status">{updatedText}</span>
          <button type="button" className="rs-btn" onClick={refreshAll}><RefreshCwIcon aria-hidden="true" />{copy.toolbar.refresh}</button>
          <button type="button" className="rs-btn" onClick={() => setResetKey((n) => n + 1)}><CrosshairIcon aria-hidden="true" />{copy.controls.reset}</button>
          <button type="button" className="rs-btn" onClick={toggleFullscreen} aria-pressed={fullscreen}>{fullscreen ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}{fullscreen ? copy.toolbar.exitFullscreen : copy.toolbar.fullscreen}</button>
        </div>
        {forbiddenAll ? <p className="im-note" role="alert">{copy.states.forbidden}</p> : null}
        {!forbiddenAll && info && !anyShown ? <p className="im-note" role="status">{copy.states.nothingOn}</p> : null}
        <div className="im-body" ref={body}>
          <aside id="im-side" className="im-side" data-open={panelOpen} aria-label={copy.controls.heading}>
            <SearchBox data={data} enabled={shown} copy={copy} onSelect={(hit) => { select({ layer: hit.layer, id: hit.id }, hit.title); setPanelOpen(false); }} />
            <h2 className="im-h">{copy.controls.heading}</h2>
            <ul className="im-layers">
              {LAYER_DEFS.map((def) => {
                const k = def.id;
                const q = queries[k];
                const locked = Boolean(info) && !available[k];
                const status = q.error instanceof ApiError ? q.error.status : 0;
                const f = filters[k];
                const features = q.data?.features.length ?? 0;
                const settled = !q.isFetching && q.data !== undefined;
                return (
                  <li key={k} className="im-layer" data-locked={locked} data-on={visible[k] && !locked}>
                    <div className="im-layer-row">
                      <button type="button" role="switch" aria-checked={visible[k] && !locked} disabled={locked} title={locked ? copy.more.locked : copy.layerHelp[k]} className="im-switch" onClick={() => setVisible((v) => ({ ...v, [k]: !v[k] }))}>
                        {locked ? <LockIcon aria-hidden="true" /> : <LegendShape entry={def.legend[0]!} />}
                        <span>{copy.layers[k]}</span>
                        {!locked && visible[k] && q.data ? <small className="im-count">{q.data.features.length}</small> : null}
                      </button>
                    </div>
                    {locked ? <p className="im-layer-note"><LockIcon aria-hidden="true" />{reason(k) === "unavailable" ? copy.more.unavailable : copy.more.locked}</p> : null}
                    {!locked && visible[k] && q.isError ? (
                      <p className="im-layer-note" role="alert">{status === 403 ? copy.more.locked : copy.states.error}{status !== 403 ? <button type="button" className="rs-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.controls.retry}</button> : null}</p>
                    ) : null}
                    {!locked && visible[k] && !q.isError && q.data === undefined && bbox ? <p className="im-layer-note">{copy.states.loading}</p> : null}
                    {!locked && visible[k] ? (
                      <div className="im-chip-groups">
                        {def.filters.map((fd) => (
                          <div key={fd.key} role="group" aria-label={fmt(copy.filters.group, { layer: copy.layers[k] })} className="im-chipset">
                            {fd.values.map((v) => <button key={v} type="button" className="im-chip" aria-pressed={f[fd.key] === v} onClick={() => setFilter(k, fd.key, v)}>{valueLabel(k, v, copy, locale)}</button>)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!locked && visible[k] && settled && !q.isError && features === 0 ? (
                      <p className="im-layer-note" role="status">{fmt(copy.more.emptyLayer, { layer: copy.layers[k].toLowerCase() })}{Object.values(f).some(Boolean) ? <button type="button" className="rs-btn" onClick={() => setFilters((all) => ({ ...all, [k]: {} }))}>{copy.filters.clearFilters}</button> : null}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {anyFilter ? <button type="button" className="rs-btn" onClick={() => setFilters(NO_FILTERS)}>{copy.filters.reset}</button> : null}
            <Legend copy={copy} locale={locale} visible={shown} />
          </aside>
          <div className="im-stage">
            {mapFailed
              ? <div className="im-failed" role="alert"><p>{copy.states.mapFailed}</p></div>
              : <InframapMap data={data} visible={shown} selected={selected} evidence={evidence.data} resetKey={resetKey} retryKey={retryKey} label={copy.mapLabel} onViewport={onViewport} onPick={onPick} onHover={setHover} onReadout={onReadout} onTilesFailed={setTilesFailed} onFailed={() => setMapFailed(true)} />}
            {tilesFailed ? <div className="im-banner" role="status">{copy.more.tilesFailed}<button type="button" className="rs-btn" onClick={() => { setTilesFailed(false); setRetryKey((n) => n + 1); }}><RefreshCwIcon aria-hidden="true" />{copy.controls.retry}</button></div> : null}
            {hover && hoverFeature && !chooser ? <HoverCard layer={hover.layer} feature={hoverFeature} at={hover} copy={copy} locale={locale} /> : null}
            {chooser ? <OverlapChooser candidates={chooser.candidates} at={chooser.at} copy={copy} onPick={(c) => select({ layer: c.layer, id: c.id }, c.title)} onClose={() => setChooser(null)} /> : null}
          </div>
          <aside className="im-quick" data-open={Boolean(picked && selected)} aria-label={copy.panel.heading}>
            {picked && selected
              ? <QuickView layer={selected.layer} feature={picked} evidence={evidence} copy={copy} onClose={() => select(null)} />
              : <><h2 className="im-h">{copy.panel.heading}</h2><p className="rs-help">{copy.panel.none}</p></>}
          </aside>
        </div>
        <div className="im-status" role="status" aria-label="status">
          {LAYER_KEYS.filter((k) => shown[k] && queries[k].data).map((k) => <span key={k}>{copy.layers[k]}: {queries[k].data!.features.length}</span>)}
          {LAYER_KEYS.filter((k) => shown[k] && queries[k].data?.truncated).map((k) => <span key={`t${k}`} className="im-warn">{fmt(copy.more.truncatedBar, { n: queries[k].data!.features.length, layer: copy.layers[k].toLowerCase() })}</span>)}
          {missing && missing.total > 0 ? (
            <span className="im-missing">
              <button type="button" className="rs-btn" aria-expanded={missingOpen} onClick={() => setMissingOpen((o) => !o)}><MapPinOffIcon aria-hidden="true" />{missing.total === 1 ? copy.more.noLocationOne : fmt(copy.more.noLocation, { n: missing.total })}</button>
              {missingOpen ? (
                <div className="im-popover" role="dialog" aria-label={copy.more.noLocationTitle}>
                  <strong>{copy.more.noLocationTitle}</strong>
                  <p className="rs-help">{copy.more.noLocationHelp}</p>
                  <ul>{missing.items.map((p) => <li key={p.id}><Link href={`/projects/${p.id}/overview`}>{p.projectCode} · {p.title}</Link></li>)}</ul>
                  {missing.total > missing.items.length ? <p className="rs-help">{fmt(copy.more.moreNotShown, { n: missing.total - missing.items.length })}</p> : null}
                </div>
              ) : null}
            </span>
          ) : null}
          <span className="im-readout">{copy.more.zoom} {readout.zoom ? readout.zoom.toFixed(1) : "—"}{readout.lat !== null && readout.lng !== null ? ` · ${copy.more.cursor} ${readout.lat.toFixed(4)}, ${readout.lng.toFixed(4)}` : ""}</span>
          <span className="im-attrib">© OpenStreetMap contributors</span>
        </div>
        <div className="sr-only" aria-live="polite">{announce}</div>
      </div>
    </StaffWorkspaceShell>
  );
}
