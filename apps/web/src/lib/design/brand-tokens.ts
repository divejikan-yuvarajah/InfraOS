/** Programmatic brand hex references — must match `apps/web/src/styles/tokens.css`. */

export const INFRAOS_BRAND = {
  orange: "#FF5B00",
  yellow: "#FEB600",
  maroon: "#8C1F28",
  green: "#279541",
} as const;

export const INFRAOS_NEUTRALS = {
  canvas: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#111827",
  textSecondary: "#475569",
  textMuted: "#64748B",
  border: "#E2E8F0",
} as const;

export const INFRAOS_ACCESSIBLE_TEXT = {
  onLight: {
    orange: "#B63D00",
    green: "#166B30",
    yellow: "#6C5311",
    critical: "#8C1F28",
  },
  onBrand: {
    primaryButton: "#111827",
    onMaroon: "#FFFFFF",
  },
} as const;
