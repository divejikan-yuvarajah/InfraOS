"use client";

import "@/styles/mission-control-roadsync.css";
import "@/styles/mission-control-inframap.css";

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CrosshairIcon, LayersIcon, MapPinOffIcon, MaximizeIcon, MinimizeIcon, RefreshCwIcon, TargetIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { useRoadsyncKeys } from "@/components/roadsync/resolution-tab";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { bboxParam, LAYER_KEYS, NO_FILTERS, summarize, type Bbox, type Filters, type LayerData, type LayerKey, type MapFeature } from "@/lib/inframap/inframap";
import { fetchConflictEvidence, fetchExposure, fetchFeatureDetail, fetchLayer, fetchLayers, fetchNearby } from "@/lib/inframap/inframap-api";
import { getInframapCopy } from "@/lib/inframap/inframap-copy";
import { LAYER_DEFS } from "@/lib/inframap/layer-registry";
import type { Candidate } from "@/lib/inframap/selection-priority";
import { fmt } from "@/lib/roadsync/assessment";

import { LayerDeck, type LayerQuery } from "./inframap-deck";
import type { AsyncState, Ref } from "./inframap-context-panels";
import { InframapMap, type Hover, type Readout, type Selection } from "./inframap-map";
import { HoverCard, Legend, OverlapChooser, QuickView, SearchBox, type EvidenceState, type QuickTab } from "./inframap-parts";

const VIEWPORT_DEBOUNCE_MS = 400;
/*
 * Freshness: the server is the source of truth and there are no websockets. Layer queries are fresh for 30 s, refetch on
 * window focus and reconnect, and poll every 60 s while the tab is visible. "Refresh" refetches everything on demand;
 * a changed geometry or status shows up on the next refetch.
 */
const STALE_MS = 30_000;
const POLL_MS = 60_000;
const HISTORY_MAX = 5;
const NEW_LAYERS: LayerKey[] = ["assets", "utilities", "risks"];

type HistoryEntry = { sel: Selection; title: string };

function asyncOf<T>(q: { isError: boolean; error: unknown; data: T | undefined }, enabled: boolean): AsyncState<T> {
  if (!enabled) return { status: "idle", data: null };
  if (q.isError) return { status: q.error instanceof ApiError && q.error.status === 403 ? "forbidden" : "error", data: null };
  return q.data !== undefined ? { status: "ready", data: q.data } : { status: "loading", data: null };
}

export function InframapWorkspace() {
  const [locale] = useWorkspaceLocale();
  const copy = getInframapCopy(locale);
  const keys = useRoadsyncKeys();
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>(() => Object.fromEntries(LAYER_DEFS.map((d) => [d.id, d.defaultVisible])) as Record<LayerKey, boolean>);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
  const [attention, setAttention] = useState(false);
  const [focusRaw, setFocus] = useState<LayerKey | null>(null);
  const [tab, setTab] = useState<QuickTab>("overview");
  const [expTab, setExpTab] = useState("projects");
  const [highlight, setHighlight] = useState(false);
  const [radius, setRadius] = useState(250);
  const [flyTo, setFlyTo] = useState<{ key: number; point: [number, number]; zoom: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);

  // Debounced viewport: only the last pan or zoom in a burst triggers a fetch.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onViewport = useCallback((next: Bbox) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBbox(next), VIEWPORT_DEBOUNCE_MS);
  }, []);
  const onReadout = useCallback((next: Readout) => setReadout((prev) => ({ zoom: next.zoom, lng: next.lng ?? prev.lng, lat: next.lat ?? prev.lat })), []);

  // Layer availability comes from the server; a forbidden layer is never requested.
  const layersQ = useQuery({
    queryKey: keys.key("inframap", "layers"),
    queryFn: ({ signal }) => fetchLayers(signal),
    enabled: Boolean(keys.userId), staleTime: STALE_MS, refetchInterval: POLL_MS, refetchOnWindowFocus: true, retry: false,
  });
  const info = layersQ.data;
  const ready = info !== undefined;
  const available = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, info?.layers.find((l) => l.id === k)?.available === true])) as Record<LayerKey, boolean>, [info]);
  const reasons = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, info?.layers.find((l) => l.id === k)?.reason])) as Record<LayerKey, "forbidden" | "unavailable" | undefined>, [info]);
  const shown = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, visible[k] && available[k]])) as Record<LayerKey, boolean>, [visible, available]);
  // A layer that is switched off or forbidden cannot stay focused, so Focus is derived rather than reset in an effect.
  const focus = focusRaw !== null && shown[focusRaw] ? focusRaw : null;

  // One query per layer (a fixed-length list, so there is no per-layer branching). Disabled or forbidden layers make no request.
  const results = useQueries({
    queries: LAYER_KEYS.map((layer) => {
      const f = filters[layer];
      return {
        queryKey: keys.key("inframap", `${layer}:${bbox ? bboxParam(bbox) : "none"}:${JSON.stringify(Object.entries(f).filter(([, v]) => v).sort())}`),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchLayer(layer, bbox as Bbox, f, signal),
        enabled: Boolean(keys.userId) && Boolean(bbox) && shown[layer],
        // The previous viewport's features stay on screen until the new answer arrives; a stale answer never replaces a newer one.
        placeholderData: keepPreviousData, staleTime: STALE_MS, refetchInterval: POLL_MS, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: false,
      };
    }),
  });
  const queries = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k, i) => [k, results[i] as unknown as LayerQuery])) as Record<LayerKey, LayerQuery>, [results]);
  const data = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k, i) => [k, results[i]!.data])) as Partial<Record<LayerKey, LayerData>>, [results]);

  // One toast per layer on its first failure; the layer row keeps the persistent error and Retry.
  const toasted = useRef(new Set<LayerKey>());
  const copyRef = useRef(copy);
  useEffect(() => { copyRef.current = copy; });
  const errorKey = results.map((r) => (r.isError ? "1" : "0")).join("");
  useEffect(() => {
    LAYER_KEYS.forEach((k, i) => {
      const failed = errorKey[i] === "1";
      if (failed && !toasted.current.has(k)) { toasted.current.add(k); toast.error(fmt(copyRef.current.more.firstError, { layer: copyRef.current.layers[k] })); }
      if (!failed) toasted.current.delete(k);
    });
  }, [errorKey]);

  const picked: MapFeature | undefined = selected ? data[selected.layer]?.features.find((f) => f.properties.id === selected.id) : undefined;
  const pickedInfo = picked && selected ? summarize(selected.layer, picked.properties) : null;

  // ----- per-selection lookups (conflict evidence, new-layer detail, exposure, nearby) -----
  const isNewLayer = selected ? NEW_LAYERS.includes(selected.layer) : false;
  const evidenceQ = useQuery({
    queryKey: keys.key("inframap", `evidence:${selected?.id ?? "none"}`),
    queryFn: ({ signal }) => fetchConflictEvidence(selected!.id, signal),
    enabled: Boolean(keys.userId) && selected?.layer === "conflicts", staleTime: STALE_MS, retry: false,
  });
  const evidence: EvidenceState = selected?.layer !== "conflicts" ? { status: "idle", data: null } : evidenceQ.isError ? { status: "error", data: null } : evidenceQ.data ? { status: "ready", data: evidenceQ.data } : { status: "loading", data: null };

  const detailQ = useQuery({
    queryKey: keys.key("inframap", `detail:${selected?.layer}:${selected?.id ?? "none"}`),
    queryFn: ({ signal }) => fetchFeatureDetail(selected!.layer as "assets" | "utilities" | "risks", selected!.id, signal),
    enabled: Boolean(keys.userId) && isNewLayer && Boolean(picked), staleTime: STALE_MS, retry: false,
  });
  const detail = asyncOf(detailQ, isNewLayer);

  const canExposure = available.risks;
  const exposureQ = useQuery({
    queryKey: keys.key("inframap", `exposure:${selected?.layer}:${selected?.id ?? "none"}`),
    queryFn: ({ signal }) => fetchExposure(selected!.layer, selected!.id, signal),
    enabled: Boolean(keys.userId) && Boolean(selected) && Boolean(picked) && canExposure && tab === "exposure", staleTime: STALE_MS, retry: false,
  });
  const exposure = asyncOf(exposureQ, canExposure && tab === "exposure");
  const nearbyQ = useQuery({
    queryKey: keys.key("inframap", `nearby:${selected?.layer}:${selected?.id ?? "none"}:${radius}`),
    queryFn: ({ signal }) => fetchNearby(selected!.layer, selected!.id, radius, signal),
    enabled: Boolean(keys.userId) && Boolean(selected) && Boolean(picked) && tab === "nearby", staleTime: STALE_MS, retry: false, placeholderData: keepPreviousData,
  });
  const nearby = asyncOf(nearbyQ, tab === "nearby");

  // Exposed records (zone selected) drawn with a hatched halo while "Highlight exposed" is on; cleared with the selection.
  const exposed = useMemo<MapFeature[] | null>(() => {
    if (!highlight || exposure.data?.mode !== "records") return null;
    const out: MapFeature[] = [];
    for (const bucket of Object.values(exposure.data.records)) for (const item of bucket?.items ?? []) if (item.geometry) out.push({ type: "Feature", geometry: item.geometry, properties: { id: item.id } });
    return out;
  }, [highlight, exposure.data]);
  const lens = tab === "nearby" && nearby.data ? nearby.data.envelope : null;

  const select = useCallback((next: Selection | null, title?: string, keepHistory = false) => {
    setSelected(next);
    setChooser(null);
    setTab("overview");
    setHighlight(false);
    if (!keepHistory) setHistory([]);
    setAnnounce(next && title ? fmt(copy.more.announce, { title }) : copy.more.cleared);
  }, [copy]);
  const onPick = useCallback((candidates: Candidate[], at: { x: number; y: number }) => {
    if (candidates.length === 0) { select(null); return; }
    if (candidates.length === 1) { select({ layer: candidates[0]!.layer, id: candidates[0]!.id }, candidates[0]!.title); return; }
    setChooser({ candidates, at });
  }, [select]);

  // Selecting a result from the exposure card or nearby lens: remember where we came from (max 5), enable the layer, fly there.
  const selectRef = (ref: Ref) => {
    if (selected) setHistory((h) => [...h, { sel: selected, title: pickedInfo?.title ?? copy.layers[selected.layer] }].slice(-HISTORY_MAX));
    if (available[ref.layer]) setVisible((v) => ({ ...v, [ref.layer]: true }));
    select({ layer: ref.layer, id: ref.id }, ref.title, true);
    if (ref.point) setFlyTo({ key: Date.now(), point: ref.point, zoom: 15 });
  };
  const back = history[history.length - 1];
  const goBack = () => {
    if (!back) return;
    setHistory((h) => h.slice(0, -1));
    select(back.sel, back.title, true);
  };

  // ESC closes the chooser first, then Focus, then the quick view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (chooser) setChooser(null);
      else if (focus) { setFocus(null); setAnnounce(copy.deck.focusEnded); }
      else if (selected) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chooser, focus, selected, select, copy]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === body.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void body.current?.requestFullscreen?.().catch(() => undefined);
  };

  const refreshAll = () => {
    void layersQ.refetch();
    LAYER_KEYS.forEach((k, i) => { if (shown[k]) void results[i]!.refetch(); });
    if (selected?.layer === "conflicts") void evidenceQ.refetch();
  };
  const updatedAt = Math.max(0, layersQ.dataUpdatedAt, ...LAYER_KEYS.map((k, i) => (shown[k] ? results[i]!.dataUpdatedAt : 0)));
  const updatedText = updatedAt ? fmt(copy.toolbar.updated, { time: new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Asia/Colombo" }).format(updatedAt) }) : copy.toolbar.notYet;

  const setFilter = (layer: LayerKey, key: string, value: string) => setFilters((f) => ({ ...f, [layer]: { ...f[layer], [key]: f[layer][key] === value ? undefined : value } }));
  const anyFilter = LAYER_KEYS.some((k) => Object.values(filters[k]).some(Boolean));
  const anyShown = LAYER_KEYS.some((k) => shown[k]);
  const forbiddenAll = layersQ.isError && layersQ.error instanceof ApiError && (layersQ.error.status === 403 || layersQ.error.status === 401);
  const toggleFocus = (k: LayerKey) => { const next = focus === k ? null : k; setFocus(next); setAnnounce(next ? fmt(copy.deck.focusActive, { layer: copy.layers[k] }) : copy.deck.focusEnded); };

  const hoverFeature = hover ? data[hover.layer]?.features.find((f) => f.properties.id === hover.id) : undefined;
  const missing = info?.projectsWithoutLocation;
  const hasDemo = LAYER_KEYS.some((k) => shown[k] && (data[k]?.features.some((f) => f.properties.isDemo === true) ?? false));

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <div className="im">
        <p className="rs-help">{copy.demoNote}</p>
        <div className="im-top">
          <button type="button" className="rs-btn im-panel-toggle" aria-expanded={panelOpen} aria-controls="im-side" onClick={() => setPanelOpen((o) => !o)}><LayersIcon aria-hidden="true" />{panelOpen ? copy.toolbar.hidePanel : copy.toolbar.showPanel}</button>
          <span className="im-fresh" role="status">{updatedText}</span>
          {focus ? <button type="button" className="im-focus-chip" onClick={() => toggleFocus(focus)}><TargetIcon aria-hidden="true" />{copy.deck.exitFocus} · {copy.layers[focus]}</button> : null}
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
            <LayerDeck
              copy={copy} locale={locale} queries={queries} visible={visible} available={available} ready={ready} reasons={reasons} filters={filters} hasBbox={bbox !== null} focus={focus} attention={attention}
              onToggle={(k) => setVisible((v) => ({ ...v, [k]: !v[k] }))}
              onGroup={(ids, on) => setVisible((v) => ({ ...v, ...Object.fromEntries(ids.map((k) => [k, on])) }))}
              onFilter={setFilter} onClearLayer={(k) => setFilters((all) => ({ ...all, [k]: {} }))} onFocus={toggleFocus} onAttention={() => setAttention((a) => !a)}
            />
            {anyFilter ? <button type="button" className="rs-btn" onClick={() => setFilters(NO_FILTERS)}>{copy.filters.reset}</button> : null}
            <Legend copy={copy} locale={locale} visible={shown} />
          </aside>
          <div className="im-stage">
            {mapFailed
              ? <div className="im-failed" role="alert"><p>{copy.states.mapFailed}</p></div>
              : <InframapMap data={data} visible={shown} selected={selected} evidence={evidence.data} attention={attention} focus={focus} exposed={exposed} lens={lens} flyTo={flyTo} resetKey={resetKey} retryKey={retryKey} label={copy.mapLabel} onViewport={onViewport} onPick={onPick} onHover={setHover} onReadout={onReadout} onTilesFailed={setTilesFailed} onFailed={() => setMapFailed(true)} />}
            {tilesFailed ? <div className="im-banner" role="status">{copy.more.tilesFailed}<button type="button" className="rs-btn" onClick={() => { setTilesFailed(false); setRetryKey((n) => n + 1); }}><RefreshCwIcon aria-hidden="true" />{copy.controls.retry}</button></div> : null}
            {hover && hoverFeature && !chooser ? <HoverCard layer={hover.layer} feature={hoverFeature} at={hover} copy={copy} locale={locale} /> : null}
            {chooser ? <OverlapChooser candidates={chooser.candidates} at={chooser.at} copy={copy} onPick={(c) => select({ layer: c.layer, id: c.id }, c.title)} onClose={() => setChooser(null)} /> : null}
          </div>
          <aside className="im-quick" data-open={Boolean(selected)} aria-label={copy.panel.heading}>
            {picked && selected ? (
              <QuickView
                layer={selected.layer} feature={picked} evidence={evidence} detail={detail} exposure={exposure} nearby={nearby} canExposure={canExposure}
                tab={tab} onTab={setTab} expTab={expTab} onExpTab={setExpTab} highlight={highlight} onHighlight={() => setHighlight((h) => !h)} radius={radius} onRadius={setRadius}
                onSelectRef={selectRef} back={back ? { title: back.title } : null} onBack={goBack} onClose={() => select(null)} copy={copy}
              />
            ) : selected ? (
              <div className="im-skel" aria-busy="true"><p className="rs-help">{copy.detail.pending}</p><button type="button" className="rs-btn" onClick={() => select(null)}>{copy.panel.clear}</button>{back ? <button type="button" className="rs-btn" onClick={goBack}>{fmt(copy.nearby.back, { title: back.title })}</button> : null}</div>
            ) : <><h2 className="im-h">{copy.panel.heading}</h2><p className="rs-help">{copy.panel.none}</p></>}
          </aside>
        </div>
        <div className="im-status" role="status" aria-label="status">
          {hasDemo ? <span className="im-ribbon" role="note">{copy.demo.ribbon}</span> : null}
          {LAYER_KEYS.filter((k) => shown[k] && queries[k].data).map((k) => <span key={k}>{copy.layers[k]}: {queries[k].data!.features.length}</span>)}
          {LAYER_KEYS.filter((k) => shown[k] && queries[k].data?.truncated).map((k) => <span key={`t${k}`} className="im-warn">{fmt(copy.more.truncatedBar, { n: queries[k].data!.features.length, layer: copy.layers[k].toLowerCase() })}</span>)}
          {LAYER_KEYS.filter((k) => shown[k] && (queries[k].data?.restrictedHidden ?? 0) > 0).map((k) => <span key={`r${k}`} className="im-warn">{fmt(copy.deck.restrictedHidden, { n: queries[k].data!.restrictedHidden ?? 0 })}</span>)}
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
