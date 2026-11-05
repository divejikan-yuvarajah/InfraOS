"use client";

import "@/styles/mission-control-roadsync.css";
import "@/styles/mission-control-inframap.css";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActivityIcon, CommandIcon, CopyIcon, CrosshairIcon, FilterIcon, HelpCircleIcon, LayersIcon, MapPinOffIcon, MaximizeIcon, MenuIcon, MinimizeIcon, RefreshCwIcon, SearchIcon, TargetIcon, XIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { useRoadsyncKeys } from "@/components/roadsync/resolution-tab";
import { ApiError } from "@/lib/api/client";
import type { CommandCtx } from "@/lib/inframap/commands";
import { clampOpacity } from "@/lib/inframap/focus";
import { activeFilterCount, applyPreset, EMPTY_UF, FILTER_PRESETS, ufParams, type UF } from "@/lib/inframap/filters-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { featureBounds, LAYER_KEYS, summarize, type Bbox, type LayerData, type LayerKey, type MapFeature } from "@/lib/inframap/inframap";
import { fetchConflictEvidence, fetchExposure, fetchFacets, fetchFeatureDetail, fetchLayers, fetchNearby, fetchNearbyAt, fetchSearch, type GeometryHint, type SearchData, type SearchItem } from "@/lib/inframap/inframap-api";
import { getInframapCopy } from "@/lib/inframap/inframap-copy";
import { getB3Copy } from "@/lib/inframap/inframap-copy-b3";
import { DEFAULT_ORDER, LAYER_BY_ID, LAYER_DEFS } from "@/lib/inframap/layer-registry";
import { addView, allLayers, deleteView, loadViews, renameView, storeViews, type SavedView } from "@/lib/inframap/local-store";
import type { Candidate } from "@/lib/inframap/selection-priority";
import { mapPaddingForSheet, type Snap } from "@/lib/inframap/sheet-math";
import { parseViewState, serializeViewState, ZOOM_RANGE, type ViewState } from "@/lib/inframap/url-state";
import { useViewportData } from "@/lib/inframap/use-viewport-data";
import { deviceProfile } from "@/lib/inframap/viewport";
import { fmt } from "@/lib/roadsync/assessment";

import { BottomSheet } from "./bottom-sheet";
import type { AsyncState, Ref } from "./inframap-context-panels";
import { LayerDeck, type LayerPreset, type LayerQuery } from "./inframap-deck";
import { AppliedChips, FilterPanel } from "./filter-panel";
import { FeatureDrawer, ResizeHandle, type DetailState, type DrawerTab } from "./feature-drawer";
import { InframapMap, type CameraRequest, type CaptureFn, type Hover, type MapPadding, type Readout, type Selection } from "./inframap-map";
import { HoverCard, Legend, OverlapChooser, type EvidenceState } from "./inframap-parts";
import { LinkFallbackDialog, SavedViewsDialog } from "./saved-views";
import { SearchBox } from "./search-box";

// Heavy, rarely used UI is split out of the main bundle.
const CommandPalette = dynamic(() => import("./command-palette"), { ssr: false });
const ShortcutsHelp = dynamic(() => import("./command-palette").then((m) => m.ShortcutsHelp), { ssr: false });
const MapBrief = dynamic(() => import("./map-brief"), { ssr: false });
const DataHealth = dynamic(() => import("./data-health"), { ssr: false });
const PerfHud = dynamic(() => import("./perf-hud").then((m) => m.PerfHud), { ssr: false });

const HISTORY_MAX = 5;
const STALE_MS = 30_000;
const POLL_MS = 60_000;
const DEFAULTS = { layers: LAYER_DEFS.filter((d) => d.defaultVisible).map((d) => d.id), order: DEFAULT_ORDER };
const ALL_OPAQUE = Object.fromEntries(LAYER_KEYS.map((k) => [k, 1])) as Record<LayerKey, number>;
const NO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };
type HistoryEntry = { sel: Selection; title: string };
type PanelName = "layers" | "filters" | "search" | "legend" | "menu";

function asyncOf<T>(q: { isError: boolean; error: unknown; data: T | undefined }, enabled: boolean): AsyncState<T> {
  if (!enabled) return { status: "idle", data: null };
  if (q.isError) return { status: q.error instanceof ApiError && q.error.status === 403 ? "forbidden" : "error", data: null };
  return q.data !== undefined ? { status: "ready", data: q.data } : { status: "loading", data: null };
}
const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
const hintBounds = (h: GeometryHint): [[number, number], [number, number]] => (h.kind === "bbox" ? [[h.bbox[0], h.bbox[1]], [h.bbox[2], h.bbox[3]]] : [[h.coordinates[0], h.coordinates[1]], [h.coordinates[0], h.coordinates[1]]]);

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function InframapWorkspace() {
  const [locale, setLocale] = useWorkspaceLocale();
  const copy = getInframapCopy(locale);
  const c3 = getB3Copy(locale);
  const keys = useRoadsyncKeys();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPhone = useMedia("(max-width: 639px)");
  const isTablet = useMedia("(max-width: 1023px)");

  // A shared link is parsed once; every value is validated, and nothing in it grants access.
  const [initial] = useState<ViewState>(() => parseViewState(new URLSearchParams(searchParams.toString())));
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>(() => {
    const on = new Set<LayerKey>(initial.layers ?? DEFAULTS.layers);
    if (initial.sel && initial.layers === null) on.add(initial.sel.layer);
    return Object.fromEntries(LAYER_KEYS.map((k) => [k, on.has(k)])) as Record<LayerKey, boolean>;
  });
  const [uf, setUf] = useState<UF>(initial.uf);
  const [opacity, setOpacity] = useState<Record<LayerKey, number>>({ ...ALL_OPAQUE, ...initial.opacity });
  const [order, setOrder] = useState<readonly LayerKey[]>(initial.order ?? DEFAULT_ORDER);
  const [focusRaw, setFocus] = useState<LayerKey | null>(initial.focus);
  const [attention, setAttention] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(initial.sel);
  const [fitPending, setFitPending] = useState(Boolean(initial.sel));
  const [userCamera, setUserCamera] = useState<CameraRequest | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [forward, setForward] = useState<HistoryEntry[]>([]);
  const [navList, setNavList] = useState<{ items: { layer: LayerKey; id: string; title: string }[]; index: number } | null>(null);
  const [chooser, setChooser] = useState<{ candidates: Candidate[]; at: { x: number; y: number } } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [readout, setReadout] = useState<Readout>({ zoom: 0, lng: null, lat: null });
  const [resetKey, setResetKey] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [expTab, setExpTab] = useState("projects");
  const [highlight, setHighlight] = useState(false);
  const [radius, setRadius] = useState(250);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [placeOutline, setPlaceOutline] = useState<{ type: "Polygon"; coordinates: number[][][] } | null>(null);
  const [scope, setScope] = useState<"view" | "all">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [panel, setPanel] = useState<PanelName | null>(null);
  const [panelSnap, setPanelSnap] = useState<Snap>("half");
  const [drawerSnap, setDrawerSnap] = useState<Snap>("peek");
  const [drawerWidth, setDrawerWidth] = useState(380);
  const [locked, setLocked] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [linkFallback, setLinkFallback] = useState<string | null>(null);
  const [views, setViews] = useState<SavedView[]>(() => loadViews(DEFAULTS));
  const [perf, setPerf] = useState(() => process.env.NODE_ENV !== "production" && searchParams.get("perf") === "1");
  const [profile] = useState(() => deviceProfile(typeof window === "undefined" ? { width: 1280 } : { width: window.innerWidth, saveData: (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData, cores: navigator.hardwareConcurrency }));
  const body = useRef<HTMLDivElement>(null);
  const captureRef = useRef<CaptureFn | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const placeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharedChecked = useRef(false);
  useEffect(() => () => { if (placeTimer.current) clearTimeout(placeTimer.current); }, []);

  // ----- layer availability (server) -----
  const layersQ = useQuery({
    queryKey: keys.key("inframap", "layers"), queryFn: ({ signal }) => fetchLayers(signal),
    enabled: Boolean(keys.userId), staleTime: STALE_MS, refetchInterval: POLL_MS, refetchOnWindowFocus: true, retry: false,
  });
  const info = layersQ.data;
  const ready = info !== undefined;
  const available = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, info?.layers.find((l) => l.id === k)?.available === true])) as Record<LayerKey, boolean>, [info]);
  const reasons = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, info?.layers.find((l) => l.id === k)?.reason])) as Record<LayerKey, "forbidden" | "unavailable" | undefined>, [info]);
  const shown = useMemo(() => Object.fromEntries(LAYER_KEYS.map((k) => [k, visible[k] && available[k]])) as Record<LayerKey, boolean>, [visible, available]);
  const focus = focusRaw !== null && shown[focusRaw] ? focusRaw : null; // derived: a hidden layer cannot stay focused

  // ----- the single data pipeline -----
  const pipeline = useViewportData({ userId: keys.userId, keyOf: keys.key, shown, uf, profile });
  const { data, queries, viewport, onViewport, stats } = pipeline;

  const errorKey = LAYER_KEYS.map((k) => (queries[k]?.isError ? "1" : "0")).join("");
  const toasted = useRef(new Set<LayerKey>());
  const copyRef = useRef(copy);
  useEffect(() => { copyRef.current = copy; });
  useEffect(() => {
    LAYER_KEYS.forEach((k, i) => {
      const failed = errorKey[i] === "1";
      if (failed && !toasted.current.has(k)) { toasted.current.add(k); toast.error(fmt(copyRef.current.more.firstError, { layer: copyRef.current.layers[k] })); }
      if (!failed) toasted.current.delete(k);
    });
  }, [errorKey]);

  // ----- selection, detail, evidence, exposure, nearby -----
  const picked: MapFeature | undefined = selected ? data[selected.layer]?.features.find((f) => f.properties.id === selected.id) : undefined;
  const detailQ = useQuery({
    queryKey: keys.key("inframap", `detail:${selected?.layer}:${selected?.id ?? "none"}`),
    queryFn: ({ signal }) => fetchFeatureDetail(selected!.layer, selected!.id, signal),
    enabled: Boolean(keys.userId) && Boolean(selected), staleTime: STALE_MS, retry: false,
  });
  const detail: DetailState = detailQ.data ? { status: "ready", data: detailQ.data } : detailQ.isError ? (detailQ.error instanceof ApiError && [403, 404].includes(detailQ.error.status) ? { status: "unavailable", data: null } : { status: "error", data: null }) : { status: "loading", data: null };
  const pickedInfo = selected ? summarize(selected.layer, (detailQ.data?.properties ?? picked?.properties ?? {})) : null;
  const detailGeometry = detailQ.data?.geometry ?? null;
  const selectedFeature = useMemo<MapFeature | null>(() => picked ?? (selected && detailGeometry ? { type: "Feature", geometry: detailGeometry, properties: { id: selected.id } } : null), [picked, selected, detailGeometry]);

  // Camera: an explicit move wins; otherwise a pending "fit to the selected feature" is derived once its geometry is known.
  // Keys are bumped with a functional update, and any explicit move clears a pending fit.
  const [fitCount, setFitCount] = useState(0);
  const fitBoundsOf = fitPending && detailGeometry ? featureBounds(detailGeometry) : null;
  const fitCamera = useMemo<CameraRequest | null>(() => (fitBoundsOf ? { key: -fitCount - 1, bounds: fitBoundsOf, maxZoom: 17 } : null), [fitBoundsOf, fitCount]);
  const camera = fitCamera ?? userCamera;
  const setCamera = useCallback((req: Omit<CameraRequest, "key">) => { setFitPending(false); setUserCamera((prev) => ({ ...req, key: (prev?.key ?? 0) + 1 })); }, []);

  const evidenceQ = useQuery({
    queryKey: keys.key("inframap", `evidence:${selected?.id ?? "none"}`), queryFn: ({ signal }) => fetchConflictEvidence(selected!.id, signal),
    enabled: Boolean(keys.userId) && selected?.layer === "conflicts", staleTime: STALE_MS, retry: false,
  });
  const evidence: EvidenceState = selected?.layer !== "conflicts" ? { status: "idle", data: null } : evidenceQ.isError ? { status: "error", data: null } : evidenceQ.data ? { status: "ready", data: evidenceQ.data } : { status: "loading", data: null };
  const canExposure = available.risks;
  const exposureQ = useQuery({
    queryKey: keys.key("inframap", `exposure:${selected?.layer}:${selected?.id ?? "none"}`), queryFn: ({ signal }) => fetchExposure(selected!.layer, selected!.id, signal),
    enabled: Boolean(keys.userId) && Boolean(selected) && canExposure && tab === "exposure", staleTime: STALE_MS, retry: false,
  });
  const exposure = asyncOf(exposureQ, canExposure && tab === "exposure");
  const nearbyQ = useQuery({
    queryKey: keys.key("inframap", `nearby:${selected?.layer}:${selected?.id ?? "none"}:${radius}`), queryFn: ({ signal }) => fetchNearby(selected!.layer, selected!.id, radius, signal),
    enabled: Boolean(keys.userId) && Boolean(selected) && tab === "nearby", staleTime: STALE_MS, retry: false, placeholderData: keepPreviousData,
  });
  const nearby = asyncOf(nearbyQ, tab === "nearby");
  const pinRadius = 100;
  const pinQ = useQuery({
    queryKey: keys.key("inframap", `pin:${pin?.[0]}:${pin?.[1]}:${pinRadius}`), queryFn: ({ signal }) => fetchNearbyAt(pin![1], pin![0], pinRadius, signal),
    enabled: Boolean(keys.userId) && Boolean(pin), staleTime: STALE_MS, retry: false,
  });
  const facetsQ = useQuery({
    queryKey: keys.key("inframap", `facets:${viewport ? viewport.bbox.join(",") : "none"}:${ufParams(uf)}`), queryFn: ({ signal }) => fetchFacets(viewport?.bbox ?? null, uf, signal),
    enabled: Boolean(keys.userId) && ready && (filtersOpen || panel === "filters" || uf.agencyId.length > 0 || briefOpen), staleTime: 15_000, retry: false, placeholderData: keepPreviousData,
  });

  const exposed = useMemo<MapFeature[] | null>(() => {
    if (!highlight || exposure.data?.mode !== "records") return null;
    const out: MapFeature[] = [];
    for (const bucket of Object.values(exposure.data.records)) for (const item of bucket?.items ?? []) if (item.geometry) out.push({ type: "Feature", geometry: item.geometry, properties: { id: item.id } });
    return out;
  }, [highlight, exposure.data]);
  const lens = tab === "nearby" && nearby.data ? nearby.data.envelope : pin && pinQ.data ? pinQ.data.envelope : placeOutline;

  // ----- actions -----
  const flyToHint = useCallback((hint: GeometryHint | null | undefined) => {
    if (!hint) return;
    if (hint.kind === "point") setCamera({ point: hint.coordinates, zoom: 15 });
    else setCamera({ bounds: hintBounds(hint), maxZoom: 17 });
  }, [setCamera]);
  const select = useCallback((next: Selection | null, title?: string, opts: { keepHistory?: boolean; fit?: boolean; nav?: typeof navList } = {}) => {
    setSelected(next);
    setChooser(null);
    setTab("overview");
    setHighlight(false);
    setFitPending(Boolean(next && opts.fit));
    if (next && opts.fit) setFitCount((n) => n + 1);
    if (!opts.keepHistory) { setHistory([]); setForward([]); }
    setNavList(next ? opts.nav ?? null : null);
    setAnnounce(next && title ? fmt(copy.more.announce, { title }) : copy.more.cleared);
    if (next) setDrawerSnap("peek");
  }, [copy]);
  const closeDrawer = () => { select(null); setLocked(false); };
  const onPick = useCallback((candidates: Candidate[], at: { x: number; y: number }) => {
    if (candidates.length === 0) { if (!locked) select(null); return; }
    const nav = { items: candidates.map((c) => ({ layer: c.layer, id: c.id, title: c.title })), index: 0 };
    if (candidates.length === 1) { select({ layer: candidates[0]!.layer, id: candidates[0]!.id }, candidates[0]!.title); return; }
    setChooser({ candidates, at });
    void nav;
  }, [select, locked]);

  // A shared feature the viewer may not open: say so without revealing anything; the drawer shows the same neutral message.
  useEffect(() => {
    if (sharedChecked.current || !initial.sel || detail.status === "loading") return;
    sharedChecked.current = true;
    if (detail.status === "unavailable") toast.message(c3.search.sharedUnavailable);
  }, [detail.status, initial.sel, c3.search.sharedUnavailable]);

  const selectRef = (ref: Ref) => {
    if (selected) setHistory((h) => [...h, { sel: selected, title: pickedInfo?.title ?? copy.layers[selected.layer] }].slice(-HISTORY_MAX));
    setForward([]);
    if (available[ref.layer]) setVisible((v) => ({ ...v, [ref.layer]: true }));
    select({ layer: ref.layer, id: ref.id }, ref.title, { keepHistory: true, fit: !ref.point });
    if (ref.point) setCamera({ point: ref.point, zoom: 15 });
  };
  const back = history[history.length - 1];
  const goBack = () => {
    if (!back) return;
    if (selected) setForward((f) => [...f, { sel: selected, title: pickedInfo?.title ?? copy.layers[selected.layer] }].slice(-HISTORY_MAX));
    setHistory((h) => h.slice(0, -1));
    select(back.sel, back.title, { keepHistory: true, fit: true });
  };
  const goForward = () => {
    const next = forward[forward.length - 1];
    if (!next) return;
    if (selected) setHistory((h) => [...h, { sel: selected, title: pickedInfo?.title ?? copy.layers[selected.layer] }].slice(-HISTORY_MAX));
    setForward((f) => f.slice(0, -1));
    select(next.sel, next.title, { keepHistory: true, fit: true });
  };

  const searchLayers = useMemo(() => [...LAYER_KEYS.filter((k) => available[k]), "agencies", "places"], [available]);
  const searchFn = useCallback((q: string, sc: "view" | "all", signal: AbortSignal): Promise<SearchData> => fetchSearch({ q, scope: sc, bbox: viewport?.bbox ?? null, uf, layers: searchLayers }, signal), [viewport, uf, searchLayers]);
  const searchKey = useMemo(() => [...keys.key("inframap", "q"), ufParams(uf), viewport?.bbox.join(",") ?? ""], [keys, uf, viewport]);

  const onSearchItem = useCallback((item: SearchItem, _q: string, siblings: SearchItem[]) => {
    setPanel(null); setSidebarOpen(false);
    if (item.layer === "places") {
      if (item.geometryHint?.kind === "bbox") {
        const [w, s, e, n] = item.geometryHint.bbox;
        setPlaceOutline({ type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
        if (placeTimer.current) clearTimeout(placeTimer.current);
        placeTimer.current = setTimeout(() => setPlaceOutline(null), 8000);
        flyToHint(item.geometryHint);
        toast.message(fmt(c3.search.placeApplied, { name: item.title }));
      }
      return;
    }
    if (item.layer === "agencies") {
      setUf((cur) => (cur.agencyId.includes(item.id) ? cur : { ...cur, agencyId: [...cur.agencyId, item.id].slice(-12) }));
      toast.message(fmt(c3.search.agencyApplied, { name: item.title }));
      return;
    }
    const layer = item.layer as LayerKey;
    if (!available[layer]) return;
    if (!visible[layer]) { setVisible((v) => ({ ...v, [layer]: true })); toast.message(fmt(c3.search.layerOn, { layer: copy.layers[layer] })); }
    const nav = siblings.length > 1 ? { items: siblings.map((s) => ({ layer: s.layer as LayerKey, id: s.id, title: s.title })), index: Math.max(0, siblings.findIndex((s) => s.id === item.id)) } : null;
    select({ layer, id: item.id }, item.title, { nav });
    if (item.noLocation) { toast.message(c3.search.recordOnly); return; }
    flyToHint(item.geometryHint);
  }, [available, visible, copy, c3, select, flyToHint]);

  const onCoordinates = useCallback((c: { lat: number; lng: number }) => {
    setPin([c.lng, c.lat]);
    setCamera({ point: [c.lng, c.lat], zoom: 14 });
    setPanel(null); setSidebarOpen(false);
  }, [setCamera]);

  // ----- view state: apply / serialise / share -----
  const applyView = useCallback((v: ViewState) => {
    setUf(v.uf);
    setOpacity({ ...ALL_OPAQUE, ...v.opacity });
    setOrder(v.order ?? DEFAULT_ORDER);
    setFocus(v.focus);
    const on = new Set<LayerKey>(v.layers ?? DEFAULTS.layers);
    setVisible(Object.fromEntries(LAYER_KEYS.map((k) => [k, on.has(k)])) as Record<LayerKey, boolean>);
    if (v.center && v.zoom !== null) setCamera({ point: v.center, exactZoom: v.zoom });
    select(v.sel, undefined, { fit: Boolean(v.sel) });
  }, [select, setCamera]);
  const currentView = useCallback((withSel: boolean): ViewState => {
    const center: [number, number] | null = viewport ? [(viewport.bbox[0] + viewport.bbox[2]) / 2, (viewport.bbox[1] + viewport.bbox[3]) / 2] : null;
    return { center, zoom: viewport ? Math.max(ZOOM_RANGE.min, Math.min(ZOOM_RANGE.max, viewport.zoom)) : null, layers: LAYER_KEYS.filter((k) => visible[k]), opacity, order, focus, sel: withSel ? selected : null, uf };
  }, [viewport, visible, opacity, order, focus, selected, uf]);

  // Keep the URL in step with the view (debounced, replace so history is not spammed).
  const lastUrl = useRef(searchParams.toString());
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = serializeViewState(currentView(true), DEFAULTS) + (perf ? "&perf=1" : "");
      if (qs !== lastUrl.current) { lastUrl.current = qs; router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }); }
    }, 400);
    return () => clearTimeout(t);
  }, [currentView, perf, pathname, router]);

  const copyText = useCallback(async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success(c3.share.copied); } catch { setLinkFallback(url); }
  }, [c3]);
  const copyLink = useCallback(() => void copyText(`${window.location.origin}${pathname}?${serializeViewState(currentView(true), DEFAULTS)}`), [copyText, pathname, currentView]);
  const copyFeatureLink = useCallback(() => {
    if (!selected) return;
    const v = currentView(true);
    void copyText(`${window.location.origin}${pathname}?${serializeViewState({ ...v, center: null, zoom: null, layers: [...new Set([...(v.layers ?? []), selected.layer])] }, DEFAULTS)}`);
  }, [selected, currentView, copyText, pathname]);

  // ----- layer manager -----
  const setVisibleOnly = (k: LayerKey) => setVisible(Object.fromEntries(LAYER_KEYS.map((x) => [x, x === k])) as Record<LayerKey, boolean>);
  const layerPreset = (p: LayerPreset) => setVisible(Object.fromEntries(LAYER_KEYS.map((k) => [k, p === "all" ? true : LAYER_BY_ID[k].group === p])) as Record<LayerKey, boolean>);
  const resetLayers = () => { setVisible(Object.fromEntries(LAYER_KEYS.map((k) => [k, DEFAULTS.layers.includes(k)])) as Record<LayerKey, boolean>); setOpacity(ALL_OPAQUE); setOrder(DEFAULT_ORDER); setFocus(null); setAttention(false); };
  const moveLayer = (k: LayerKey, to: "front" | "back") => setOrder((cur) => {
    // Only layers of the same group trade places; conflicts and the other groups keep their slots.
    const group = LAYER_BY_ID[k].group;
    const peers = cur.filter((x) => LAYER_BY_ID[x].group === group && x !== "conflicts");
    const reordered = to === "front" ? [...peers.filter((x) => x !== k), k] : [k, ...peers.filter((x) => x !== k)];
    let i = 0;
    return cur.map((x) => (LAYER_BY_ID[x].group === group && x !== "conflicts" ? reordered[i++]! : x));
  });
  const toggleFocus = useCallback((k: LayerKey | null) => { const next = k === null || focus === k ? null : k; setFocus(next); setAnnounce(next ? fmt(copy.deck.focusActive, { layer: copy.layers[next] }) : copy.deck.focusEnded); }, [focus, copy]);
  const onCondition = (c: string) => setUf((cur) => ({ ...cur, condition: cur.condition.includes(c) ? cur.condition.filter((x) => x !== c) : [...cur.condition, c].slice(-12) }));
  const onPresetLayers = (layers: readonly LayerKey[]) => setVisible((v) => ({ ...v, ...Object.fromEntries(layers.map((l) => [l, true])) }));

  // ----- palette context, shortcuts, fullscreen -----
  const toggleFullscreen = useCallback(() => { if (document.fullscreenElement) void document.exitFullscreen(); else void body.current?.requestFullscreen?.().catch(() => undefined); }, []);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === body.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const openPanel = useCallback((p: PanelName) => {
    if (isPhone) { setPanel(p); setPanelSnap(p === "search" ? "full" : "half"); return; }
    if (p === "legend") { setLegendOpen((o) => !o); return; }
    if (p === "filters") setFiltersOpen(true);
    setSidebarOpen(true);
    setTimeout(() => document.getElementById(p === "filters" ? "im-filters" : "im-side")?.scrollIntoView({ block: "nearest" }), 0);
  }, [isPhone]);
  const paletteCtx = useMemo<CommandCtx>(() => ({
    isLayerAvailable: (k) => available[k], isLayerOn: (k) => shown[k],
    toggleLayer: (k) => setVisible((v) => ({ ...v, [k]: !v[k] })), focusLayer: (k) => toggleFocus(k),
    applyPreset: (id) => { const p = FILTER_PRESETS.find((x) => x.id === id); if (p) { setUf((cur) => applyPreset(cur, p)); onPresetLayers(p.layers.filter((l) => available[l])); } },
    clearFilters: () => setUf(EMPTY_UF), hasFilters: () => activeFilterCount(uf) > 0, resetView: () => setResetKey((n) => n + 1), copyLink, openBrief: () => setBriefOpen(true), openHealth: () => setHealthOpen(true),
    openSavedViews: () => setViewsOpen(true), toggleFullscreen, toggleLegend: () => openPanel("legend"), openShortcuts: () => setKeysOpen(true), setLocale, canRisk: () => available.risks,
  }), [available, shown, uf, toggleFocus, copyLink, toggleFullscreen, openPanel, setLocale]);

  const stepNav = (delta: number) => {
    if (!navList) return;
    const index = Math.max(0, Math.min(navList.items.length - 1, navList.index + delta));
    const it = navList.items[index]!;
    select({ layer: it.layer, id: it.id }, it.title, { keepHistory: true, fit: true, nav: { ...navList, index } });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === "p" && process.env.NODE_ENV !== "production") { e.preventDefault(); setPerf((p) => !p); return; }
      if (e.key === "Escape") {
        if (chooser) setChooser(null); else if (panel) setPanel(null); else if (focus) toggleFocus(null); else if (selected && !locked) closeDrawer();
        return;
      }
      if (isEditable(e.target) || mod || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); if (isPhone) openPanel("search"); else { setSidebarOpen(true); setTimeout(() => searchInput.current?.focus(), 0); } }
      else if (e.key === "?") setKeysOpen(true);
      else if (e.key === "[") goBack();
      else if (e.key === "]") { if (navList && navList.index < navList.items.length - 1) stepNav(1); else goForward(); }
      else if (e.shiftKey && e.key === "F") toggleFocus(null);
      else if (!e.shiftKey && e.key.toLowerCase() === "l") openPanel("layers");
      else if (!e.shiftKey && e.key.toLowerCase() === "f") openPanel("filters");
      else if (e.key.toLowerCase() === "g") openPanel("legend");
      else if (e.key.toLowerCase() === "r") setResetKey((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ----- derived UI numbers -----
  const refreshAll = () => { void layersQ.refetch(); pipeline.refetchAll(); if (selected?.layer === "conflicts") void evidenceQ.refetch(); };
  const updatedAt = Math.max(0, layersQ.dataUpdatedAt, ...LAYER_KEYS.map((k) => (shown[k] ? queries[k]?.dataUpdatedAt ?? 0 : 0)));
  const updatedText = updatedAt ? fmt(copy.toolbar.updated, { time: new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Asia/Colombo" }).format(updatedAt) }) : copy.toolbar.notYet;
  const forbiddenAll = layersQ.isError && layersQ.error instanceof ApiError && (layersQ.error.status === 403 || layersQ.error.status === 401);
  const anyShown = LAYER_KEYS.some((k) => shown[k]);
  const filterCount = activeFilterCount(uf);
  const loadedLayers = LAYER_KEYS.filter((k) => shown[k] && data[k]);
  const totalFeatures = loadedLayers.reduce((n, k) => n + (data[k]?.features.length ?? 0), 0);
  const settled = viewport !== null && LAYER_KEYS.every((k) => !shown[k] || (queries[k] && !queries[k].isFetching && (queries[k].data !== undefined || queries[k].isError)));
  const hoverFeature = hover ? data[hover.layer]?.features.find((f) => f.properties.id === hover.id) : undefined;
  const missing = info?.projectsWithoutLocation;
  const hasDemo = LAYER_KEYS.some((k) => shown[k] && (data[k]?.features.some((f) => f.properties.isDemo === true) ?? false));
  const scopeLabel = keys.roleKey === "SUPER_ADMIN" ? c3.brief.scopeNational : c3.brief.scopeAgency;

  // Map padding keeps the selected feature clear of the drawer (right, desktop) or the sheet (bottom, phone).
  const padding = useMemo<MapPadding>(() => {
    if (!selected) return NO_PADDING;
    if (isPhone) return { ...NO_PADDING, bottom: mapPaddingForSheet(drawerSnap, typeof window === "undefined" ? 800 : window.innerHeight) };
    if (isTablet) return NO_PADDING;
    return { ...NO_PADDING, right: drawerWidth };
  }, [selected, isPhone, isTablet, drawerSnap, drawerWidth]);

  const detailForDrawer = (variant: "panel" | "sheet") => selected ? (
    <FeatureDrawer
      layer={selected.layer} id={selected.id} placeholder={picked} detail={detail} evidence={evidence} exposure={exposure} nearby={nearby} canExposure={canExposure}
      tab={tab} onTab={(t) => { setTab(t); if (variant === "sheet" && drawerSnap === "peek") setDrawerSnap("half"); }} expTab={expTab} onExpTab={setExpTab} highlight={highlight} onHighlight={() => setHighlight((h) => !h)} radius={radius} onRadius={setRadius}
      onSelectRef={selectRef} back={back ? { title: back.title } : null} onBack={goBack} onClose={closeDrawer} onRetry={() => void detailQ.refetch()}
      onZoom={() => { const b = featureBounds(detailGeometry ?? picked?.geometry); if (b) setCamera({ bounds: b, maxZoom: 17 }); }}
      onCopyLink={copyFeatureLink} locked={locked} onLock={() => setLocked((l) => !l)}
      nav={navList && navList.items.length > 1 ? { index: navList.index, count: navList.items.length, onPrev: () => stepNav(-1), onNext: () => stepNav(1) } : null}
      copy={copy} c3={c3}
    />
  ) : null;

  const searchBox = (id: string, autofocus: boolean) => (
    <SearchBox copy={copy} c3={c3} locale={locale} scope={scope} onScope={setScope} search={searchFn} queryKey={searchKey} onSelect={onSearchItem} onCoordinates={onCoordinates} inputId={id} autoFocus={autofocus} {...(id === "im-search" ? { inputRef: searchInput } : {})} />
  );
  const deck = (
    <LayerDeck
      copy={copy} c3={c3} locale={locale} queries={queries as unknown as Record<LayerKey, LayerQuery>} visible={visible} available={available} ready={ready} reasons={reasons} uf={uf} hasBbox={viewport !== null} focus={focus} attention={attention}
      opacity={opacity} order={order} onToggle={(k) => setVisible((v) => ({ ...v, [k]: !v[k] }))} onGroup={(ids, on) => setVisible((v) => ({ ...v, ...Object.fromEntries(ids.map((k) => [k, on])) }))}
      onFocus={toggleFocus} onAttention={() => setAttention((a) => !a)} onCondition={onCondition} onOpacity={(k, v) => setOpacity((o) => ({ ...o, [k]: clampOpacity(v) }))}
      onMove={moveLayer} onShowOnly={setVisibleOnly} onPreset={layerPreset} onResetLayers={resetLayers}
    />
  );
  const filtersUi = <FilterPanel uf={uf} setUf={setUf} facets={facetsQ.data} available={available} copy={copy} c3={c3} locale={locale} onPresetLayers={onPresetLayers} />;
  const legendUi = <Legend copy={copy} locale={locale} visible={shown} />;

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <div className="im" data-phone={isPhone}>
        <p className="rs-help">{copy.demoNote}</p>
        <div className="im-top">
          {!isPhone ? <button type="button" className="rs-btn im-panel-toggle" aria-expanded={sidebarOpen} aria-controls="im-side" onClick={() => setSidebarOpen((o) => !o)}><LayersIcon aria-hidden="true" />{sidebarOpen ? copy.toolbar.hidePanel : copy.toolbar.showPanel}</button> : null}
          <span className="im-fresh" role="status">{updatedText}</span>
          {focus ? <button type="button" className="im-focus-chip" onClick={() => toggleFocus(null)}><TargetIcon aria-hidden="true" />{copy.deck.exitFocus} · {copy.layers[focus]}</button> : null}
          <button type="button" className="rs-btn" onClick={() => setPaletteOpen(true)} aria-label={c3.pal.open} title={c3.pal.hint}><CommandIcon aria-hidden="true" />{!isPhone ? c3.pal.hint : null}</button>
          <button type="button" className="rs-btn" onClick={() => { if (isPhone) openPanel("filters"); else { setFiltersOpen((o) => !o); setSidebarOpen(true); } }} aria-expanded={filtersOpen}><FilterIcon aria-hidden="true" />{c3.fp.open}{filterCount ? <small className="im-count">{filterCount}</small> : null}</button>
          <button type="button" className="rs-btn" onClick={refreshAll}><RefreshCwIcon aria-hidden="true" />{!isPhone ? copy.toolbar.refresh : <span className="sr-only">{copy.toolbar.refresh}</span>}</button>
          <button type="button" className="rs-btn" onClick={() => setResetKey((n) => n + 1)}><CrosshairIcon aria-hidden="true" />{!isPhone ? copy.controls.reset : <span className="sr-only">{copy.controls.reset}</span>}</button>
          <button type="button" className="rs-btn" onClick={copyLink}><CopyIcon aria-hidden="true" />{!isPhone ? c3.share.copy : <span className="sr-only">{c3.share.copy}</span>}</button>
          <button type="button" className="rs-btn" onClick={() => setHealthOpen(true)}><ActivityIcon aria-hidden="true" /><span className={isPhone ? "sr-only" : undefined}>{c3.hl.title}</span></button>
          <button type="button" className="rs-btn" onClick={() => setBriefOpen(true)}>{c3.brief.title}</button>
          <button type="button" className="rs-btn" onClick={() => setViewsOpen(true)}>{c3.share.views}</button>
          <button type="button" className="rs-btn" onClick={toggleFullscreen} aria-pressed={fullscreen}>{fullscreen ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}<span className={isPhone ? "sr-only" : undefined}>{fullscreen ? copy.toolbar.exitFullscreen : copy.toolbar.fullscreen}</span></button>
          <button type="button" className="rs-btn" onClick={() => setKeysOpen(true)} aria-label={c3.keys.title}><HelpCircleIcon aria-hidden="true" /></button>
        </div>
        <AppliedChips uf={uf} setUf={setUf} copy={copy} c3={c3} locale={locale} facets={facetsQ.data} />
        {forbiddenAll ? <p className="im-note" role="alert">{copy.states.forbidden}</p> : null}
        {!forbiddenAll && info && !anyShown ? <p className="im-note" role="status">{copy.states.nothingOn}</p> : null}
        <div className="im-body" ref={body} data-drawer={Boolean(selected) && !isPhone && !isTablet} style={{ ["--im-drawer-w" as string]: `${drawerWidth}px` }}>
          {!isPhone ? (
            <aside id="im-side" className="im-side" data-open={sidebarOpen} aria-label={copy.controls.heading}>
              {searchBox("im-search", false)}
              <h2 className="im-h">{copy.controls.heading}</h2>
              {deck}
              <details id="im-filters" className="im-fdetails" open={filtersOpen} onToggle={(e) => setFiltersOpen((e.currentTarget as HTMLDetailsElement).open)}>
                <summary>{c3.fp.heading}{filterCount ? <small className="im-count">{filterCount}</small> : null}</summary>
                {filtersOpen ? filtersUi : null}
              </details>
              <details className="im-fdetails" open={legendOpen} onToggle={(e) => setLegendOpen((e.currentTarget as HTMLDetailsElement).open)}><summary>{copy.controls.legend}</summary>{legendUi}</details>
            </aside>
          ) : null}
          <div className="im-stage">
            {mapFailed
              ? <div className="im-failed" role="alert"><p>{copy.states.mapFailed}</p></div>
              : (
                <InframapMap
                  data={data} visible={shown} opacity={opacity} order={order} selectedFeature={selectedFeature} evidence={evidence.data} attention={attention} focus={focus} exposed={exposed} lens={lens} pin={pin}
                  camera={camera} padding={padding} initialView={initial.center && initial.zoom !== null ? { center: initial.center, zoom: initial.zoom } : null} resetKey={resetKey} retryKey={retryKey}
                  label={copy.mapLabel} captureRef={captureRef} onViewport={onViewport} onPick={onPick} onHover={setHover} onReadout={(r: Readout) => setReadout((prev) => ({ zoom: r.zoom, lng: r.lng ?? prev.lng, lat: r.lat ?? prev.lat }))}
                  onLongPress={(ll) => { setPin(ll); setPanel("menu"); setPanelSnap("peek"); }} onTilesFailed={setTilesFailed} onFailed={() => setMapFailed(true)}
                />
              )}
            {tilesFailed ? <div className="im-banner" role="status">{copy.more.tilesFailed}<button type="button" className="rs-btn" onClick={() => { setTilesFailed(false); setRetryKey((n) => n + 1); }}><RefreshCwIcon aria-hidden="true" />{copy.controls.retry}</button></div> : null}
            {settled && filterCount > 0 && totalFeatures === 0 ? <div className="im-empty" role="status"><p>{c3.fp.empty}</p><button type="button" className="rs-btn is-primary" onClick={() => setUf(EMPTY_UF)}>{copy.filters.clearFilters}</button></div> : null}
            {hover && hoverFeature && !chooser && !isPhone ? <HoverCard layer={hover.layer} feature={hoverFeature} at={hover} copy={copy} locale={locale} /> : null}
            {chooser ? <OverlapChooser candidates={chooser.candidates} at={chooser.at} copy={copy} onPick={(c) => select({ layer: c.layer, id: c.id }, c.title, { nav: { items: chooser.candidates.map((x) => ({ layer: x.layer, id: x.id, title: x.title })), index: Math.max(0, chooser.candidates.findIndex((x) => x.id === c.id)) } })} onClose={() => setChooser(null)} /> : null}
            {pin && !isPhone ? <div className="im-pinbar"><span>{c3.mob.pin}: {pin[1].toFixed(4)}, {pin[0].toFixed(4)}</span><button type="button" className="rs-btn" onClick={() => setPin(null)}>{c3.mob.clearPin}</button></div> : null}
          </div>
          {!isPhone ? (
            <aside className="im-quick" data-open={Boolean(selected)} data-overlay={isTablet} aria-label={copy.panel.heading}>
              {selected && !isTablet ? <ResizeHandle width={drawerWidth} onWidth={setDrawerWidth} label={c3.dr.resize} /> : null}
              {selected ? detailForDrawer("panel") : <><h2 className="im-h">{copy.panel.heading}</h2><p className="rs-help">{copy.panel.none}</p></>}
            </aside>
          ) : null}
        </div>

        <div className="im-status" role="status" aria-label="status">
          {hasDemo ? <span className="im-ribbon" role="note">{copy.demo.ribbon}</span> : null}
          {loadedLayers.length > 0 ? <span className="im-summary">{loadedLayers.length === 1 && totalFeatures === 1 ? c3.fp.summaryOne : fmt(c3.fp.summaryMany, { n: totalFeatures, layers: loadedLayers.length })}</span> : null}
          {LAYER_KEYS.filter((k) => shown[k] && data[k]?.truncated).map((k) => <span key={`t${k}`} className="im-warn">{fmt(copy.more.truncatedBar, { n: data[k]!.features.length, layer: copy.layers[k].toLowerCase() })}{data[k]!.total !== undefined ? ` (${data[k]!.total})` : ""}</span>)}
          {LAYER_KEYS.filter((k) => shown[k] && (data[k]?.restrictedHidden ?? 0) > 0).map((k) => <span key={`r${k}`} className="im-warn">{fmt(copy.deck.restrictedHidden, { n: data[k]!.restrictedHidden ?? 0 })}</span>)}
          {missing && missing.total > 0 ? (
            <span className="im-missing">
              <button type="button" className="rs-btn" aria-expanded={missingOpen} onClick={() => setMissingOpen((o) => !o)}><MapPinOffIcon aria-hidden="true" />{missing.total === 1 ? copy.more.noLocationOne : fmt(copy.more.noLocation, { n: missing.total })}</button>
              {missingOpen ? (
                <div className="im-popover" role="dialog" aria-label={copy.more.noLocationTitle}>
                  <strong>{copy.more.noLocationTitle}</strong>
                  <p className="rs-help">{copy.more.noLocationHelp}</p>
                  <ul>{missing.items.map((p) => <li key={p.id}><button type="button" className="im-link" onClick={() => { setMissingOpen(false); setVisible((v) => ({ ...v, projects: true })); select({ layer: "projects", id: p.id }, p.title); }}>{p.projectCode} · {p.title}</button> <Link href={`/projects/${p.id}/overview`}><span className="sr-only">{p.title}</span>↗</Link></li>)}</ul>
                  {missing.total > missing.items.length ? <p className="rs-help">{fmt(copy.more.moreNotShown, { n: missing.total - missing.items.length })}</p> : null}
                </div>
              ) : null}
            </span>
          ) : null}
          {!isPhone ? <span className="im-readout">{copy.more.zoom} {readout.zoom ? readout.zoom.toFixed(1) : "—"}{readout.lat !== null && readout.lng !== null ? ` · ${copy.more.cursor} ${readout.lat.toFixed(4)}, ${readout.lng.toFixed(4)}` : ""}</span> : null}
          <span className="im-attrib">© OpenStreetMap contributors</span>
        </div>
        <div className="sr-only" aria-live="polite">{announce}</div>
        {perf && process.env.NODE_ENV !== "production" ? <PerfHud data={data} stats={stats} /> : null}

        {isPhone ? (
          <>
            <nav className="im-dock" aria-label={c3.mob.menu}>
              <button type="button" className="im-dock-btn" aria-pressed={panel === "layers"} onClick={() => openPanel("layers")}><LayersIcon aria-hidden="true" /><span>{c3.mob.layers}</span></button>
              <button type="button" className="im-dock-btn" aria-pressed={panel === "filters"} onClick={() => openPanel("filters")}><FilterIcon aria-hidden="true" /><span>{c3.mob.filters}</span>{filterCount ? <small className="im-count">{filterCount}</small> : null}</button>
              <button type="button" className="im-dock-btn" aria-pressed={panel === "search"} onClick={() => openPanel("search")}><SearchIcon aria-hidden="true" /><span>{c3.mob.search}</span></button>
              <button type="button" className="im-dock-btn" aria-pressed={panel === "legend"} onClick={() => openPanel("legend")}><MenuIcon aria-hidden="true" /><span>{c3.mob.legend}</span></button>
            </nav>
            <BottomSheet open={Boolean(selected) && panel === null} snap={drawerSnap} onSnap={setDrawerSnap} onClose={closeDrawer} title={pickedInfo?.title ?? copy.panel.heading} closeLabel={c3.mob.closeSheet} handleLabel={c3.mob.handle}>{detailForDrawer("sheet")}</BottomSheet>
            <BottomSheet
              open={panel !== null} snap={panelSnap} onSnap={setPanelSnap} onClose={() => setPanel(null)} closeLabel={c3.mob.closeSheet} handleLabel={c3.mob.handle}
              title={panel === "layers" ? c3.mob.layers : panel === "filters" ? c3.fp.heading : panel === "search" ? c3.mob.search : panel === "legend" ? c3.mob.legend : c3.mob.pin}
            >
              {panel === "layers" ? deck : null}
              {panel === "filters" ? <>{filtersUi}<button type="button" className="rs-btn is-primary im-sticky" onClick={() => setPanel(null)}>{c3.fp.apply}</button></> : null}
              {panel === "search" ? searchBox("im-search-m", true) : null}
              {panel === "legend" ? <div className="im-legend-grid">{legendUi}</div> : null}
              {panel === "menu" && pin ? (
                <div className="im-nearby">
                  <p className="im-legend-h">{c3.mob.pin}: {pin[1].toFixed(4)}, {pin[0].toFixed(4)}</p>
                  <p className="rs-help">{c3.mob.whatsNearby}</p>
                  {pinQ.isLoading ? <p className="rs-help">{copy.nearby.loading}</p> : null}
                  {pinQ.data ? (["assets", "utilities", "risks"] as const).map((k) => pinQ.data!.layers[k]?.items.length ? <div key={k}><p className="im-legend-h">{copy.layers[k]} · {pinQ.data!.layers[k]!.total}</p><ul className="im-rows">{pinQ.data!.layers[k]!.items.map((i) => <li key={i.id}><button type="button" className="im-item" onClick={() => { setPanel(null); selectRef({ layer: k, id: i.id, title: i.name, point: i.point }); }}><span>{i.name}</span></button></li>)}</ul></div> : null) : null}
                  {pinQ.data && !(["assets", "utilities", "risks"] as const).some((k) => pinQ.data!.layers[k]?.items.length) ? <p className="im-exp-none">{fmt(copy.nearby.none, { m: pinRadius })}</p> : null}
                  <button type="button" className="rs-btn" onClick={() => { setPin(null); setPanel(null); }}><XIcon aria-hidden="true" />{c3.mob.clearPin}</button>
                </div>
              ) : null}
            </BottomSheet>
          </>
        ) : null}

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} c3={c3} copy={copy} ctx={paletteCtx} search={(q, signal) => searchFn(q, "all", signal)} onRecord={(item) => onSearchItem(item, "", [item])} queryKey={searchKey} />
        <ShortcutsHelp open={keysOpen} onOpenChange={setKeysOpen} c3={c3} />
        <MapBrief open={briefOpen} onOpenChange={setBriefOpen} copy={copy} c3={c3} locale={locale} data={data} shown={shown} uf={uf} viewport={viewport?.bbox ?? null} scopeLabel={scopeLabel} roleLabel={keys.roleKey} captureRef={captureRef} userKey={keys.userId} queryKey={keys.key("inframap", "b")} />
        <DataHealth open={healthOpen} onOpenChange={setHealthOpen} copy={copy} c3={c3} locale={locale} userKey={keys.userId} queryKey={keys.key("inframap", "h")} />
        <SavedViewsDialog
          open={viewsOpen} onOpenChange={setViewsOpen} c3={c3} views={views}
          onSave={(name) => { const next = addView(views, name, serializeViewState(currentView(false), DEFAULTS)); if (!next) return; setViews(next); toast[storeViews(next) ? "success" : "error"](storeViews(next) ? c3.share.saved : c3.share.storageOff); }}
          onApply={(v) => applyView(parseViewState(new URLSearchParams(v.query)))}
          onRename={(id, name) => { const next = renameView(views, id, name); setViews(next); storeViews(next); }}
          onDelete={(id) => { const next = deleteView(views, id); setViews(next); storeViews(next); toast.success(c3.share.deleted); }}
        />
        <LinkFallbackDialog open={linkFallback !== null} onOpenChange={(o) => { if (!o) setLinkFallback(null); }} c3={c3} url={linkFallback ?? ""} />
      </div>
    </StaffWorkspaceShell>
  );
}

export { allLayers };
export type { LayerData, Bbox };
