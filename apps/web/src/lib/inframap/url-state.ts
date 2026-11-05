import { z } from "zod";

import { EMPTY_UF, LIST_KEYS, MAX_MULTI, type UF } from "./filters-state";
import { validValue } from "./filter-options";
import { LAYER_KEYS, type LayerKey } from "./inframap";

/**
 * Shareable map state in the query string: ll, z, layers, op, ord, fs, sel and the unified filters (same names as the API).
 * Everything read from a URL is validated; unknown or malformed values are ignored and coordinates are clamped to Sri Lanka.
 * Nothing in a link grants access: the selected feature is fetched through the normal authorized endpoint.
 */
export type ViewState = {
  center: [number, number] | null; // [lng, lat]
  zoom: number | null;
  layers: LayerKey[] | null;
  opacity: Partial<Record<LayerKey, number>>;
  order: readonly LayerKey[] | null;
  focus: LayerKey | null;
  sel: { layer: LayerKey; id: string } | null;
  uf: UF;
};

export const EMPTY_VIEW: ViewState = { center: null, zoom: null, layers: null, opacity: {}, order: null, focus: null, sel: null, uf: EMPTY_UF };
export const URL_BOUNDS = { west: 78.4, south: 4.9, east: 83.1, north: 10.9 } as const;
export const ZOOM_RANGE = { min: 3, max: 19 } as const;

const layer = z.enum(LAYER_KEYS as unknown as [LayerKey, ...LayerKey[]]);
const num = z.coerce.number().refine(Number.isFinite);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, dp: number) => Number(v.toFixed(dp));

export function parseViewState(params: URLSearchParams): ViewState {
  const out: ViewState = { ...EMPTY_VIEW, opacity: {}, uf: { ...EMPTY_UF } };
  const ll = params.get("ll")?.split(",");
  if (ll?.length === 2) {
    const lat = num.safeParse(ll[0]), lng = num.safeParse(ll[1]);
    if (lat.success && lng.success) out.center = [clamp(lng.data, URL_BOUNDS.west, URL_BOUNDS.east), clamp(lat.data, URL_BOUNDS.south, URL_BOUNDS.north)];
  }
  const zParam = params.get("z");
  const z = num.safeParse(zParam);
  if (zParam !== null && zParam !== "" && z.success) out.zoom = clamp(z.data, ZOOM_RANGE.min, ZOOM_RANGE.max);
  const layers = params.get("layers");
  if (layers !== null) out.layers = [...new Set(layers.split(",").filter((l) => layer.safeParse(l).success))] as LayerKey[];
  const op = params.get("op");
  if (op) {
    for (const pair of op.split(",").slice(0, 6)) {
      const [l, v] = pair.split(":");
      const parsedLayer = layer.safeParse(l), parsedValue = num.safeParse(v);
      if (parsedLayer.success && v !== undefined && v !== "" && parsedValue.success) out.opacity[parsedLayer.data] = round(clamp(parsedValue.data, 0, 1), 2);
    }
  }
  const ord = params.get("ord")?.split(",").filter((l) => layer.safeParse(l).success) as LayerKey[] | undefined;
  if (ord && new Set(ord).size === LAYER_KEYS.length) out.order = ord;
  const fs = params.get("fs");
  if (fs && layer.safeParse(fs).success) out.focus = fs as LayerKey;
  const sel = params.get("sel")?.split(":");
  if (sel?.length === 2 && layer.safeParse(sel[0]).success && /^[a-f0-9]{24}$/i.test(sel[1]!)) out.sel = { layer: sel[0] as LayerKey, id: sel[1]! };
  for (const key of LIST_KEYS) {
    const raw = params.get(key);
    if (raw) out.uf[key] = [...new Set(raw.split(",").map((v) => v.trim()).filter((v) => validValue(key, v)))].slice(0, MAX_MULTI);
  }
  for (const key of ["dateFrom", "dateTo"] as const) { const v = params.get(key); if (v && day.safeParse(v).success) out.uf[key] = v; }
  if (params.get("overdue") === "1") out.uf.overdue = true;
  if (params.get("attention") === "1") out.uf.attention = true;
  const group = params.get("conflictStatusGroup");
  if (group === "open" || group === "resolved") out.uf.conflictStatusGroup = group;
  if (out.uf.dateFrom && out.uf.dateTo && out.uf.dateFrom > out.uf.dateTo) { out.uf.dateFrom = ""; out.uf.dateTo = ""; }
  return out;
}

export type DefaultView = { layers: readonly LayerKey[]; order: readonly LayerKey[] };

/** Only non-default values are written, so an untouched workspace has a clean URL. */
export function serializeViewState(v: ViewState, defaults: DefaultView): string {
  const p = new URLSearchParams();
  if (v.center) p.set("ll", `${round(v.center[1], 5)},${round(v.center[0], 5)}`);
  if (v.zoom !== null) p.set("z", String(round(v.zoom, 2)));
  const sameLayers = v.layers && v.layers.length === defaults.layers.length && defaults.layers.every((l) => v.layers!.includes(l));
  if (v.layers && !sameLayers) p.set("layers", v.layers.join(","));
  const ops = Object.entries(v.opacity).filter(([, o]) => o !== undefined && o < 1);
  if (ops.length) p.set("op", ops.map(([l, o]) => `${l}:${o}`).join(","));
  if (v.order && v.order.join() !== defaults.order.join()) p.set("ord", v.order.join(","));
  if (v.focus) p.set("fs", v.focus);
  if (v.sel) p.set("sel", `${v.sel.layer}:${v.sel.id}`);
  for (const key of LIST_KEYS) if (v.uf[key].length) p.set(key, v.uf[key].join(","));
  if (v.uf.dateFrom) p.set("dateFrom", v.uf.dateFrom);
  if (v.uf.dateTo) p.set("dateTo", v.uf.dateTo);
  if (v.uf.overdue) p.set("overdue", "1");
  if (v.uf.attention) p.set("attention", "1");
  if (v.uf.conflictStatusGroup) p.set("conflictStatusGroup", v.uf.conflictStatusGroup);
  return p.toString();
}
