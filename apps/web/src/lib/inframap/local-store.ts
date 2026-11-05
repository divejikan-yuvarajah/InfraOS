import { EMPTY_UF, type UF } from "./filters-state";
import { parseViewState, serializeViewState } from "./url-state";
import { LAYER_KEYS, type LayerKey } from "./inframap";

/**
 * Device-local storage for recent searches and saved views. Every read and write is wrapped, so private mode, quota errors
 * or a corrupted value can never break the workspace, and stored values are re-validated on load (the same parser as a
 * shared link). Saved views live on THIS device only; there is no server-side store.
 */
export const VIEWS_KEY = "infraos.inframap.views.v1";
export const RECENT_KEY = "infraos.inframap.recent.v1";
export const MAX_VIEWS = 12;
export const MAX_RECENT = 8;

function read(key: string): unknown {
  try { return JSON.parse(globalThis.localStorage?.getItem(key) ?? "null"); } catch { return null; }
}
function write(key: string, value: unknown): boolean {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const loadRecent = (): string[] => {
  const raw = read(RECENT_KEY);
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && v.length >= 2 && v.length <= 80).slice(0, MAX_RECENT) : [];
};
export function pushRecent(list: string[], q: string): string[] {
  const t = q.trim().replace(/\s+/g, " ");
  if (t.length < 2 || t.length > 80) return list;
  return [t, ...list.filter((v) => v.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
}
export const saveRecent = (list: string[]): boolean => write(RECENT_KEY, list);

export type SavedView = { id: string; name: string; query: string; savedAt: string };

const cleanName = (v: unknown): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60) : "");

/** Re-validates every stored entry: bad ones are dropped, a stored query is only kept in its parsed-and-reserialised form. */
export function loadViews(defaults: { layers: readonly LayerKey[]; order: readonly LayerKey[] }): SavedView[] {
  const raw = read(VIEWS_KEY);
  if (!raw || typeof raw !== "object" || (raw as { v?: number }).v !== 1 || !Array.isArray((raw as { views?: unknown }).views)) return [];
  const out: SavedView[] = [];
  for (const item of (raw as { views: unknown[] }).views.slice(0, MAX_VIEWS)) {
    const e = item as Partial<SavedView>;
    const name = cleanName(e?.name);
    if (!name || typeof e.id !== "string" || !/^[a-z0-9-]{4,40}$/i.test(e.id) || typeof e.query !== "string" || e.query.length > 2000) continue;
    out.push({ id: e.id, name, query: serializeViewState(parseViewState(new URLSearchParams(e.query)), defaults), savedAt: typeof e.savedAt === "string" ? e.savedAt.slice(0, 40) : "" });
  }
  return out;
}
export const storeViews = (views: SavedView[]): boolean => write(VIEWS_KEY, { v: 1, views: views.slice(0, MAX_VIEWS) });

export function addView(list: SavedView[], name: string, query: string, now = new Date()): SavedView[] | null {
  const n = cleanName(name);
  if (!n || list.length >= MAX_VIEWS) return null;
  return [...list, { id: `v${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: n, query, savedAt: now.toISOString() }];
}
export const renameView = (list: SavedView[], id: string, name: string): SavedView[] => { const n = cleanName(name); return n ? list.map((v) => (v.id === id ? { ...v, name: n } : v)) : list; };
export const deleteView = (list: SavedView[], id: string): SavedView[] => list.filter((v) => v.id !== id);

export const emptyUf = (): UF => ({ ...EMPTY_UF });
export const allLayers = (): LayerKey[] => [...LAYER_KEYS];
