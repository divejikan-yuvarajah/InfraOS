/**
 * Opacity composition for Focus mode and the layer manager. Each map layer's base opacity (as created by the registry,
 * possibly an expression) is captured once; the value actually painted is base x (layer opacity) x (0.25 when another layer
 * is focused). Releasing Focus or moving a slider back to 100 % restores the exact base value, including "unset".
 */
export const FOCUS_DIM = 0.25;

export const OPACITY_PROPS: Record<string, readonly string[]> = {
  fill: ["fill-opacity"], line: ["line-opacity"], circle: ["circle-opacity", "circle-stroke-opacity"], symbol: ["icon-opacity", "text-opacity"],
};

/** A numeric opacity is scaled; an expression is wrapped so data-driven styling (e.g. attention dimming) keeps working. */
export function scaleOpacity(base: unknown, factor: number): unknown {
  if (factor === 1) return base;
  if (base === undefined || base === null) return factor;
  if (typeof base === "number") return base * factor;
  return ["*", base, factor];
}

/** The multiplier for one layer: its slider value, times the Focus dim when a different layer is focused. */
export const layerFactor = (layer: string, focus: string | null, opacity: number): number => opacity * (focus && focus !== layer ? FOCUS_DIM : 1);

export const clampOpacity = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 100) / 100)) : 1);
