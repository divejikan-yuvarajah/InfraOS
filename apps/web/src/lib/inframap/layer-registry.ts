import type { Map as MlMap } from "maplibre-gl";

import { BAND_COLOR, BANDS_ASC } from "@/lib/roadsync/assessment";

import { CLOSED_CONFLICT_STATUSES, PROJECT_STATUS_COLOR, type LayerKey } from "./inframap";
import { CONDITION_COLOR, HAZARD_LEVEL_COLOR, registerIcons, UTILITY_COLOR } from "./map-icons";

/**
 * THE extension seam. The workspace, layer panel, legend, filters, click handling and data hooks are all generated from
 * LAYER_DEFS. A new layer (Batch 02: assets, utilities, risks) is one more entry here plus its API path and fetcher;
 * no component needs a per-layer branch. `z` is the draw order, lowest first.
 */
export type FilterDef = { key: string; values: readonly string[] };
export type LegendEntry = {
  id: string;
  shape: "dot" | "line" | "dash" | "dashdot" | "dotted" | "square" | "ring" | "diamond" | "triangle" | "check" | "badge";
  color: string;
  /** When set, the legend draws this exact map sprite ("asset:ROAD:POOR", "hatch:HIGH", "hex:water", "risk:HIGH"). */
  sprite?: string;
};
export type LayerDef = {
  id: LayerKey;
  group: "operations" | "infrastructure" | "risk";
  z: number;
  defaultVisible: boolean;
  /** Matched against `/inframap/layers` availability. */
  permissionLayerId: LayerKey;
  sourceId: string;
  /** Every map layer this def adds; visibility is toggled on these, never by rebuilding the map. */
  layerIds: readonly string[];
  /** Map layers a pointer can hit. */
  interactiveLayerIds: readonly string[];
  filters: readonly FilterDef[];
  legend: readonly LegendEntry[];
  quickViewKind: "project" | "roadwork" | "conflict" | "asset" | "utility" | "risk";
  /** Idempotent: safe to call again after a style reload. */
  addToMap(map: MlMap): void;
  /** Layers that must sit above conflict hotspots (point markers). Called after every def has added its base layers. */
  addTopToMap?(map: MlMap): void;
};

export const WORK_COLOR: Record<string, string> = { DRAFT: "#64748b", SUBMITTED: "#1d4ed8", PLANNED: "#0f766e", APPROVED: "#15803d", ACTIVE: "#c2410c", COMPLETED: "#334155", CANCELLED: "#9ca3af" };
export const OVERDUE_COLOR = "#b91c1c";
export const EVIDENCE_COLOR = { a: "#0369a1", b: "#a21caf" } as const;
export const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] as unknown[] };

const status = (colors: Record<string, string>, fallback: string) =>
  ["match", ["get", "status"], ...Object.entries(colors).flatMap(([k, v]) => [k, v]), fallback] as never;
const inStatus = (values: readonly string[]) => ["in", ["get", "status"], ["literal", [...values]]] as never;
const isPoint = ["==", ["geometry-type"], "Point"] as never;
const notPoint = ["!=", ["geometry-type"], "Point"] as never;
const overdue = ["==", ["get", "isOverdue"], true] as never;
const notOverdue = ["!=", ["get", "isOverdue"], true] as never;
const closedConflict = ["in", ["get", "status"], ["literal", [...CLOSED_CONFLICT_STATUSES]]] as never;
const ensureSource = (map: MlMap, id: string, extra: Record<string, unknown> = {}) => {
  if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY_COLLECTION as never, ...extra } as never);
};
type AnyLayer = Parameters<MlMap["addLayer"]>[0];
const ensureLayer = (map: MlMap, layer: AnyLayer) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };

const PROJECT_SOLID = ["ACTIVE", "COMPLETED", "DELAYED"] as const;
const PROJECT_BADGED = ["DELAYED", "COMPLETED", "ON_HOLD"] as const;

const projects: LayerDef = {
  id: "projects", group: "operations", z: 10, defaultVisible: true, permissionLayerId: "projects", sourceId: "im-projects", quickViewKind: "project",
  layerIds: ["im-projects-fill", "im-projects-casing", "im-projects-line", "im-projects-line-dash", "im-projects-cluster", "im-projects-cluster-count", "im-projects-point", "im-projects-badge"],
  interactiveLayerIds: ["im-projects-fill", "im-projects-line", "im-projects-line-dash", "im-projects-cluster", "im-projects-point"],
  filters: [{ key: "status", values: ["ACTIVE", "APPROVED", "DELAYED", "ON_HOLD", "COMPLETED"] }],
  legend: [
    { id: "ACTIVE", shape: "line", color: PROJECT_STATUS_COLOR.ACTIVE! }, { id: "APPROVED", shape: "dash", color: PROJECT_STATUS_COLOR.APPROVED! },
    { id: "DELAYED", shape: "badge", color: PROJECT_STATUS_COLOR.DELAYED! }, { id: "ON_HOLD", shape: "dash", color: PROJECT_STATUS_COLOR.ON_HOLD! },
    { id: "COMPLETED", shape: "check", color: PROJECT_STATUS_COLOR.COMPLETED! },
  ],
  addToMap(map) {
    // Points cluster; lines and polygons in the same source pass through unclustered.
    ensureSource(map, "im-projects", { cluster: true, clusterRadius: 50, clusterMaxZoom: 13 });
    const color = status(PROJECT_STATUS_COLOR, "#64748b");
    const single = ["!", ["has", "point_count"]] as never;
    ensureLayer(map, { id: "im-projects-fill", type: "fill", source: "im-projects", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": color, "fill-opacity": 0.16 } });
    ensureLayer(map, { id: "im-projects-casing", type: "line", source: "im-projects", filter: notPoint, paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.85 } });
    ensureLayer(map, { id: "im-projects-line", type: "line", source: "im-projects", filter: ["all", notPoint, inStatus(PROJECT_SOLID)] as never, paint: { "line-color": color, "line-width": 3 } });
    ensureLayer(map, { id: "im-projects-line-dash", type: "line", source: "im-projects", filter: ["all", notPoint, ["!", inStatus(PROJECT_SOLID)]] as never, paint: { "line-color": color, "line-width": 3, "line-dasharray": [3, 1.5] } });
    ensureLayer(map, { id: "im-projects-cluster", type: "circle", source: "im-projects", filter: ["has", "point_count"], paint: { "circle-color": "#0b1f3a", "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 50, 24] as never, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
    ensureLayer(map, { id: "im-projects-cluster-count", type: "symbol", source: "im-projects", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"] as never, "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"], "text-size": 12 }, paint: { "text-color": "#ffffff" } });
    ensureLayer(map, { id: "im-projects-point", type: "circle", source: "im-projects", filter: ["all", isPoint, single] as never, paint: {
      "circle-radius": 7, "circle-color": color, "circle-stroke-color": "#ffffff",
      // Ring weight differs by status as well as colour: active heavy, planned light, delayed amber-outlined.
      "circle-stroke-width": ["match", ["get", "status"], "ACTIVE", 3.5, "DELAYED", 3.5, ["APPROVED", "SUBMITTED", "DRAFT"], 1, 2] as never,
    } });
    ensureLayer(map, { id: "im-projects-badge", type: "symbol", source: "im-projects", filter: ["all", isPoint, single, inStatus(PROJECT_BADGED)] as never, layout: {
      "icon-image": ["match", ["get", "status"], "DELAYED", "im-badge-warn", "COMPLETED", "im-badge-check", "im-badge-pause"] as never,
      "icon-size": 0.45, "icon-offset": [14, -14], "icon-allow-overlap": true,
    } });
  },
};

const roadworks: LayerDef = {
  id: "roadworks", group: "operations", z: 20, defaultVisible: true, permissionLayerId: "roadworks", sourceId: "im-roadworks", quickViewKind: "roadwork",
  layerIds: ["im-roadworks-fill", "im-roadworks-casing", "im-roadworks-line-solid", "im-roadworks-line-dash", "im-roadworks-line-dot", "im-roadworks-line-faded", "im-roadworks-line-overdue", "im-roadworks-point", "im-roadworks-badge-line", "im-roadworks-badge-point"],
  interactiveLayerIds: ["im-roadworks-fill", "im-roadworks-line-solid", "im-roadworks-line-dash", "im-roadworks-line-dot", "im-roadworks-line-faded", "im-roadworks-line-overdue", "im-roadworks-point"],
  filters: [{ key: "status", values: ["SUBMITTED", "PLANNED", "APPROVED", "ACTIVE", "COMPLETED"] }, { key: "overdue", values: ["1"] }],
  legend: [
    { id: "ACTIVE", shape: "line", color: WORK_COLOR.ACTIVE! }, { id: "APPROVED", shape: "dash", color: WORK_COLOR.APPROVED! },
    { id: "SUBMITTED", shape: "dotted", color: WORK_COLOR.SUBMITTED! }, { id: "COMPLETED", shape: "line", color: WORK_COLOR.COMPLETED! },
    { id: "overdue", shape: "badge", color: OVERDUE_COLOR }, { id: "point", shape: "square", color: "#c2410c" },
  ],
  addToMap(map) {
    ensureSource(map, "im-roadworks");
    const color = status(WORK_COLOR, "#c2410c");
    const line = (id: string, statuses: readonly string[], paint: Record<string, unknown>) =>
      ensureLayer(map, { id, type: "line", source: "im-roadworks", filter: ["all", notPoint, notOverdue, inStatus(statuses)] as never, paint: { "line-color": color, ...paint } as never });
    ensureLayer(map, { id: "im-roadworks-fill", type: "fill", source: "im-roadworks", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": ["case", overdue, OVERDUE_COLOR, color] as never, "fill-opacity": 0.2 } });
    ensureLayer(map, { id: "im-roadworks-casing", type: "line", source: "im-roadworks", filter: notPoint, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 } });
    line("im-roadworks-line-solid", ["ACTIVE"], { "line-width": 5 });
    line("im-roadworks-line-dash", ["PLANNED", "APPROVED", "CANCELLED"], { "line-width": 4, "line-dasharray": [3, 1.5] });
    line("im-roadworks-line-dot", ["SUBMITTED", "DRAFT"], { "line-width": 4, "line-dasharray": [0.4, 1.6] });
    line("im-roadworks-line-faded", ["COMPLETED"], { "line-width": 2, "line-opacity": 0.5 });
    ensureLayer(map, { id: "im-roadworks-line-overdue", type: "line", source: "im-roadworks", filter: ["all", notPoint, overdue] as never, paint: { "line-color": OVERDUE_COLOR, "line-width": 4, "line-dasharray": [1, 1.2] } });
    ensureLayer(map, { id: "im-roadworks-point", type: "symbol", source: "im-roadworks", filter: isPoint, layout: { "icon-image": "im-square", "icon-size": 0.5, "icon-allow-overlap": true } });
    ensureLayer(map, { id: "im-roadworks-badge-line", type: "symbol", source: "im-roadworks", filter: ["all", notPoint, overdue] as never, layout: { "symbol-placement": "line-center", "icon-image": "im-badge-warn", "icon-size": 0.5, "icon-allow-overlap": true } });
    ensureLayer(map, { id: "im-roadworks-badge-point", type: "symbol", source: "im-roadworks", filter: ["all", isPoint, overdue] as never, layout: { "icon-image": "im-badge-warn", "icon-size": 0.45, "icon-offset": [14, -14], "icon-allow-overlap": true } });
  },
};

const conflicts: LayerDef = {
  id: "conflicts", group: "operations", z: 30, defaultVisible: true, permissionLayerId: "conflicts", sourceId: "im-conflicts", quickViewKind: "conflict",
  layerIds: ["im-evidence-casing", "im-evidence-line", "im-evidence-connector", "im-evidence-point", "im-conflicts-ring", "im-conflicts-symbol"],
  interactiveLayerIds: ["im-conflicts-symbol"],
  filters: [{ key: "band", values: [...BANDS_ASC] }, { key: "group", values: ["open", "closed"] }],
  legend: [
    { id: "info", shape: "dot", color: BAND_COLOR.info }, { id: "low", shape: "ring", color: BAND_COLOR.low }, { id: "medium", shape: "diamond", color: BAND_COLOR.medium },
    { id: "high", shape: "triangle", color: BAND_COLOR.high }, { id: "critical", shape: "triangle", color: BAND_COLOR.critical }, { id: "closed", shape: "check", color: "#64748b" },
  ],
  addToMap(map) {
    ensureSource(map, "im-conflicts");
    ensureSource(map, "im-evidence");
    // Evidence sits under the hotspots and over roadworks.
    const party = ["==", ["get", "feature"], "party"] as never;
    const side = ["match", ["get", "side"], "a", EVIDENCE_COLOR.a, EVIDENCE_COLOR.b] as never;
    ensureLayer(map, { id: "im-evidence-casing", type: "line", source: "im-evidence", filter: ["all", party, notPoint] as never, paint: { "line-color": "#ffffff", "line-width": 9 } });
    ensureLayer(map, { id: "im-evidence-line", type: "line", source: "im-evidence", filter: ["all", party, notPoint] as never, paint: { "line-color": side, "line-width": 5 } });
    ensureLayer(map, { id: "im-evidence-connector", type: "line", source: "im-evidence", filter: ["==", ["get", "feature"], "connector"], paint: { "line-color": "#0f172a", "line-width": 2, "line-dasharray": [2, 2] } });
    ensureLayer(map, { id: "im-evidence-point", type: "circle", source: "im-evidence", filter: ["all", party, isPoint] as never, paint: { "circle-radius": 8, "circle-color": side, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
    // A static ring marks high and critical open records; there is no animation to disable for reduced motion.
    ensureLayer(map, { id: "im-conflicts-ring", type: "circle", source: "im-conflicts", filter: ["all", ["in", ["get", "band"], ["literal", ["high", "critical"]]], ["!", closedConflict]] as never, paint: {
      "circle-radius": 22, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 2, "circle-stroke-opacity": 0.65,
      "circle-stroke-color": ["match", ["get", "band"], "critical", BAND_COLOR.critical, BAND_COLOR.high] as never,
    } });
    ensureLayer(map, { id: "im-conflicts-symbol", type: "symbol", source: "im-conflicts", layout: {
      "icon-image": ["case", closedConflict, "im-c-closed", ["concat", "im-c-", ["coalesce", ["get", "band"], "info"]]] as never,
      "icon-size": ["interpolate", ["linear"], ["coalesce", ["get", "score"], 0], 0, 0.55, 100, 0.85] as never,
      "icon-allow-overlap": true, "icon-ignore-placement": true, "symbol-sort-key": ["coalesce", ["get", "score"], 0] as never,
    } });
  },
};

const COND_COLOR = status(CONDITION_COLOR, "#64748b");
const CLASS_COLOR = ["match", ["get", "utilityClass"], ...Object.entries(UTILITY_COLOR).flatMap(([k, v]) => [k, v]), "#64748b"] as never;
const demoOutline = (map: MlMap, id: string, source: string, filter: unknown) =>
  // DEMO features get a diagonal-dash outline so they cannot be mistaken for official data in a screenshot.
  ensureLayer(map, { id, type: "line", source, filter: ["all", filter, ["==", ["get", "isDemo"], true]] as never, paint: { "line-color": "#0f172a", "line-width": 1.5, "line-dasharray": [1, 2.5] } });

const assets: LayerDef = {
  id: "assets", group: "infrastructure", z: 7, defaultVisible: false, permissionLayerId: "assets", sourceId: "im-assets", quickViewKind: "asset",
  layerIds: ["im-assets-fill", "im-assets-casing", "im-assets-line", "im-assets-demo", "im-assets-attn", "im-assets-cluster", "im-assets-cluster-count", "im-assets-point"],
  interactiveLayerIds: ["im-assets-fill", "im-assets-line", "im-assets-cluster", "im-assets-point"],
  filters: [{ key: "assetType", values: ["ROAD", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"] }, { key: "condition", values: ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL", "UNKNOWN"] }],
  legend: [
    ...["ROAD", "BRIDGE", "BUILDING", "PUBLIC_FACILITY"].map((t) => ({ id: t, shape: "dot" as const, color: "#64748b", sprite: `asset:${t}:GOOD` })),
    ...["FAIR", "POOR", "CRITICAL", "UNKNOWN"].map((c) => ({ id: `cond:${c}`, shape: "ring" as const, color: CONDITION_COLOR[c]!, sprite: `asset:ROAD:${c}` })),
  ],
  addToMap(map) {
    ensureSource(map, "im-assets", { cluster: true, clusterRadius: 45, clusterMaxZoom: 14 });
    ensureLayer(map, { id: "im-assets-fill", type: "fill", source: "im-assets", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": COND_COLOR, "fill-opacity": 0.18 } });
    ensureLayer(map, { id: "im-assets-casing", type: "line", source: "im-assets", filter: notPoint, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 } });
    ensureLayer(map, { id: "im-assets-line", type: "line", source: "im-assets", filter: notPoint, paint: { "line-color": COND_COLOR, "line-width": 4 } });
    demoOutline(map, "im-assets-demo", "im-assets", notPoint);
  },
  addTopToMap(map) {
    const single = ["!", ["has", "point_count"]] as never;
    ensureLayer(map, { id: "im-assets-attn", type: "circle", source: "im-assets", filter: ["all", isPoint, single, ["==", ["get", "needsAttention"], true]] as never, paint: { "circle-radius": 24, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#b91c1c", "circle-stroke-width": 2, "circle-stroke-opacity": 0.8 } });
    ensureLayer(map, { id: "im-assets-cluster", type: "circle", source: "im-assets", filter: ["has", "point_count"], paint: { "circle-color": "#334155", "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 23] as never, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
    ensureLayer(map, { id: "im-assets-cluster-count", type: "symbol", source: "im-assets", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"] as never, "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"], "text-size": 12 }, paint: { "text-color": "#ffffff" } });
    ensureLayer(map, { id: "im-assets-point", type: "symbol", source: "im-assets", filter: ["all", isPoint, single] as never, layout: { "icon-image": ["concat", "im-a-", ["get", "assetType"], "-", ["get", "condition"]] as never, "icon-size": 0.62, "icon-allow-overlap": true } });
  },
};

const utilities: LayerDef = {
  id: "utilities", group: "infrastructure", z: 6, defaultVisible: false, permissionLayerId: "utilities", sourceId: "im-utilities", quickViewKind: "utility",
  layerIds: ["im-utilities-fill", "im-utilities-casing", "im-utilities-water", "im-utilities-drainage", "im-utilities-electricity", "im-utilities-telecom", "im-utilities-demo", "im-utilities-point"],
  interactiveLayerIds: ["im-utilities-fill", "im-utilities-water", "im-utilities-drainage", "im-utilities-electricity", "im-utilities-telecom", "im-utilities-point"],
  filters: [{ key: "assetType", values: ["WATER", "DRAINAGE", "ELECTRICITY", "TELECOM"] }],
  legend: [
    { id: "water", shape: "line", color: UTILITY_COLOR.water! }, { id: "drainage", shape: "dash", color: UTILITY_COLOR.drainage! },
    { id: "electricity", shape: "dashdot", color: UTILITY_COLOR.electricity! }, { id: "telecom", shape: "dotted", color: UTILITY_COLOR.telecom! },
    { id: "facility", shape: "dot", color: UTILITY_COLOR.water!, sprite: "hex:water" },
  ],
  addToMap(map) {
    ensureSource(map, "im-utilities");
    ensureLayer(map, { id: "im-utilities-fill", type: "fill", source: "im-utilities", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": CLASS_COLOR, "fill-opacity": 0.08 } });
    ensureLayer(map, { id: "im-utilities-casing", type: "line", source: "im-utilities", filter: notPoint, paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.85 } });
    // Line style differs by class as well as colour: line-dasharray cannot be data-driven, so one layer per class.
    const cls = (id: string, name: string, dash: number[] | null) =>
      ensureLayer(map, { id, type: "line", source: "im-utilities", filter: ["all", notPoint, ["==", ["get", "utilityClass"], name]] as never, paint: { "line-color": UTILITY_COLOR[name]!, "line-width": 3, ...(dash ? { "line-dasharray": dash } : {}) } });
    cls("im-utilities-water", "water", null);
    cls("im-utilities-drainage", "drainage", [3, 1.5]);
    cls("im-utilities-electricity", "electricity", [4, 1.5, 1, 1.5]);
    cls("im-utilities-telecom", "telecom", [0.5, 1.5]);
    demoOutline(map, "im-utilities-demo", "im-utilities", notPoint);
  },
  addTopToMap(map) {
    ensureLayer(map, { id: "im-utilities-point", type: "symbol", source: "im-utilities", filter: isPoint, layout: { "icon-image": ["concat", "im-u-", ["coalesce", ["get", "utilityClass"], "water"]] as never, "icon-size": 0.5, "icon-allow-overlap": true } });
  },
};

const isHazard = ["==", ["get", "kind"], "hazard"] as never;
const isMarker = ["==", ["get", "kind"], "project"] as never;
const risks: LayerDef = {
  id: "risks", group: "risk", z: 5, defaultVisible: false, permissionLayerId: "risks", sourceId: "im-risks", quickViewKind: "risk",
  layerIds: ["im-risks-fill", "im-risks-pattern", "im-risks-flood", "im-risks-landslide", "im-risks-other", "im-risks-demo", "im-risks-hazard-point", "im-risks-marker"],
  interactiveLayerIds: ["im-risks-fill", "im-risks-hazard-point", "im-risks-marker"],
  filters: [{ key: "kind", values: ["hazard", "project"] }, { key: "hazardType", values: ["FLOOD", "LANDSLIDE", "COASTAL", "INFRASTRUCTURE_DAMAGE", "OTHER"] }, { key: "level", values: ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] }],
  legend: [
    ...["LOW", "MEDIUM", "HIGH", "VERY_HIGH"].map((l) => ({ id: `level:${l}`, shape: "square" as const, color: HAZARD_LEVEL_COLOR[l]!, sprite: `hatch:${l}` })),
    { id: "flood", shape: "line", color: "#475569" }, { id: "landslide", shape: "dash", color: "#475569" }, { id: "other", shape: "dotted", color: "#475569" },
    ...["LOW", "MEDIUM", "HIGH"].map((b) => ({ id: `band:${b}`, shape: "ring" as const, color: "#64748b", sprite: `risk:${b}` })),
  ],
  addToMap(map) {
    ensureSource(map, "im-risks");
    const poly = ["all", isHazard, ["==", ["geometry-type"], "Polygon"]] as never;
    const level = ["match", ["get", "level"], ...Object.entries(HAZARD_LEVEL_COLOR).flatMap(([k, v]) => [k, v]), "#dc2626"] as never;
    ensureLayer(map, { id: "im-risks-fill", type: "fill", source: "im-risks", filter: poly, paint: { "fill-color": level, "fill-opacity": 0.1 } });
    ensureLayer(map, { id: "im-risks-pattern", type: "fill", source: "im-risks", filter: poly, paint: { "fill-pattern": ["concat", "im-h-", ["coalesce", ["get", "level"], "HIGH"]] as never, "fill-opacity": 0.55 } });
    const outline = (id: string, filter: unknown, dash: number[] | null) =>
      ensureLayer(map, { id, type: "line", source: "im-risks", filter: ["all", poly, filter] as never, paint: { "line-color": level, "line-width": 2.5, ...(dash ? { "line-dasharray": dash } : {}) } });
    outline("im-risks-flood", ["==", ["get", "hazardType"], "FLOOD"], null);
    outline("im-risks-landslide", ["==", ["get", "hazardType"], "LANDSLIDE"], [3, 1.5]);
    outline("im-risks-other", ["!", ["in", ["get", "hazardType"], ["literal", ["FLOOD", "LANDSLIDE"]]]], [0.6, 1.6]);
    demoOutline(map, "im-risks-demo", "im-risks", poly);
    ensureLayer(map, { id: "im-risks-hazard-point", type: "circle", source: "im-risks", filter: ["all", isHazard, isPoint] as never, paint: { "circle-radius": 9, "circle-color": level, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
  },
  addTopToMap(map) {
    ensureLayer(map, { id: "im-risks-marker", type: "symbol", source: "im-risks", filter: isMarker, layout: { "icon-image": ["concat", "im-r-", ["coalesce", ["get", "riskBand"], "LOW"]] as never, "icon-size": ["match", ["get", "riskBand"], "HIGH", 0.78, "MEDIUM", 0.66, 0.54] as never, "icon-allow-overlap": true } });
  },
};

export const LAYER_DEFS: readonly LayerDef[] = [projects, roadworks, conflicts, assets, utilities, risks].sort((a, b) => a.z - b.z);
export const LAYER_GROUPS = ["operations", "infrastructure", "risk"] as const;
export const LAYER_BY_ID = Object.fromEntries(LAYER_DEFS.map((d) => [d.id, d])) as Record<LayerKey, LayerDef>;
export const ALL_INTERACTIVE_IDS = LAYER_DEFS.flatMap((d) => d.interactiveLayerIds);
/** Map layer ids per data layer, for Focus mode. */
export const LAYER_IDS_BY_LAYER: Record<string, readonly string[]> = Object.fromEntries(LAYER_DEFS.map((d) => [d.id, d.layerIds]));

/** Idempotent: checks every source, layer and icon first, so it can run on load and again after a style swap. */
export function ensureLayers(map: MlMap): void {
  registerIcons(map);
  for (const def of LAYER_DEFS) def.addToMap(map);
  for (const def of LAYER_DEFS) def.addTopToMap?.(map);
  // Temporary highlight sources: exposed records (hatched halo) and the nearby lens envelope. Cleared when not in use.
  ensureSource(map, "im-exposed");
  ensureSource(map, "im-lens");
  ensureLayer(map, { id: "im-exposed-fill", type: "fill", source: "im-exposed", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-pattern": "im-h-HIGH", "fill-opacity": 0.6 } });
  ensureLayer(map, { id: "im-exposed-line", type: "line", source: "im-exposed", filter: notPoint, paint: { "line-color": "#dc2626", "line-width": 9, "line-opacity": 0.4, "line-dasharray": [1, 1] } });
  ensureLayer(map, { id: "im-exposed-point", type: "circle", source: "im-exposed", filter: isPoint, paint: { "circle-radius": 17, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#dc2626", "circle-stroke-width": 3, "circle-stroke-opacity": 0.9 } });
  ensureLayer(map, { id: "im-lens-fill", type: "fill", source: "im-lens", paint: { "fill-color": "#0f172a", "fill-opacity": 0.04 } });
  ensureLayer(map, { id: "im-lens-line", type: "line", source: "im-lens", paint: { "line-color": "#0f172a", "line-width": 2, "line-dasharray": [3, 2] } });
  ensureSource(map, "im-selected");
  const amber = "#f59e0b";
  ensureLayer(map, { id: "im-selected-fill", type: "fill", source: "im-selected", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": amber, "fill-opacity": 0.2 } });
  ensureLayer(map, { id: "im-selected-line", type: "line", source: "im-selected", filter: notPoint, paint: { "line-color": amber, "line-width": 12, "line-opacity": 0.55 } });
  ensureLayer(map, { id: "im-selected-point", type: "circle", source: "im-selected", filter: isPoint, paint: { "circle-radius": 20, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": amber, "circle-stroke-width": 4 } });
}
