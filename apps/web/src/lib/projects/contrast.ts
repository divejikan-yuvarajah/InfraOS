function channel(hex: string, index: number): number {
  const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const normalized = hex.replace("#", "");
  return 0.2126 * channel(normalized, 0) + 0.7152 * channel(normalized, 2) + 0.0722 * channel(normalized, 4);
}

/** WCAG contrast ratio for two #rrggbb colours. */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export const STAFF_FOCUS_ORANGE = "#b63d00";
export const STAFF_CANVAS = "#f4f7fb";
export const STAFF_SURFACE = "#ffffff";
