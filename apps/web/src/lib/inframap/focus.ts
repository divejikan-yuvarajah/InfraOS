/**
 * Focus mode: dims every layer except one by scaling its opacity paint properties, and restores the exact previous
 * values (including "unset") when released. Pure over a tiny paint API so the restore logic is unit-tested.
 */
export const FOCUS_DIM = 0.25;

export const OPACITY_PROPS: Record<string, readonly string[]> = {
  fill: ["fill-opacity"], line: ["line-opacity"], circle: ["circle-opacity", "circle-stroke-opacity"], symbol: ["icon-opacity", "text-opacity"],
};

/** A numeric opacity is scaled; an expression is wrapped so data-driven styling (e.g. attention dimming) keeps working. */
export function dimmed(previous: unknown): unknown {
  if (previous === undefined || previous === null) return FOCUS_DIM;
  if (typeof previous === "number") return previous * FOCUS_DIM;
  return ["*", previous, FOCUS_DIM];
}

export type PaintApi = {
  typeOf(layerId: string): string | undefined;
  get(layerId: string, prop: string): unknown;
  set(layerId: string, prop: string, value: unknown): void;
};
export type FocusSaved = Map<string, unknown>;

const key = (layerId: string, prop: string) => `${layerId}\u0000${prop}`;

/** Restores everything previously dimmed, then dims all layers outside `focus` (null = nothing focused). */
export function applyFocus(api: PaintApi, layerIdsByLayer: Record<string, readonly string[]>, focus: string | null, saved: FocusSaved): void {
  for (const [k, value] of saved) {
    const [layerId, prop] = k.split("\u0000") as [string, string];
    if (api.typeOf(layerId)) api.set(layerId, prop, value);
  }
  saved.clear();
  if (!focus) return;
  for (const [layer, ids] of Object.entries(layerIdsByLayer)) {
    if (layer === focus) continue;
    for (const id of ids) {
      const type = api.typeOf(id);
      for (const prop of (type ? OPACITY_PROPS[type] : undefined) ?? []) {
        const previous = api.get(id, prop);
        saved.set(key(id, prop), previous);
        api.set(id, prop, dimmed(previous));
      }
    }
  }
}
