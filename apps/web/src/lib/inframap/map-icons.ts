import type { Map as MlMap } from "maplibre-gl";

import { BAND_COLOR, BANDS_ASC } from "@/lib/roadsync/assessment";

const SIZE = 48;

function draw(paint: (g: CanvasRenderingContext2D) => void): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.lineJoin = "round";
  paint(g);
  return g.getImageData(0, 0, SIZE, SIZE);
}

const C = SIZE / 2;
function shape(g: CanvasRenderingContext2D, kind: "circle" | "ring" | "diamond" | "triangle" | "square") {
  g.beginPath();
  if (kind === "diamond") { g.moveTo(C, 5); g.lineTo(SIZE - 5, C); g.lineTo(C, SIZE - 5); g.lineTo(5, C); g.closePath(); }
  else if (kind === "triangle") { g.moveTo(C, 5); g.lineTo(SIZE - 5, SIZE - 8); g.lineTo(5, SIZE - 8); g.closePath(); }
  else if (kind === "square") g.rect(9, 9, SIZE - 18, SIZE - 18);
  else g.arc(C, C, 16, 0, Math.PI * 2);
}
function filled(color: string, kind: Parameters<typeof shape>[1]) {
  return draw((g) => {
    shape(g, kind); g.fillStyle = color; g.fill(); g.lineWidth = 3.5; g.strokeStyle = "#ffffff"; g.stroke();
    if (kind === "ring") { g.beginPath(); g.arc(C, C, 22, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = color; g.stroke(); }
  });
}
function check(g: CanvasRenderingContext2D, color: string) {
  g.beginPath(); g.moveTo(14, 25); g.lineTo(21, 32); g.lineTo(34, 17); g.lineWidth = 4.5; g.strokeStyle = color; g.lineCap = "round"; g.stroke();
}

/** Shape per severity band so the map never relies on colour alone: circle, ring, diamond, triangle (high and critical). */
const BAND_SHAPE = { info: "circle", low: "ring", medium: "diamond", high: "triangle", critical: "triangle" } as const;

/** Canvas-drawn sprites, registered idempotently so a style reload restores them. */
export function registerIcons(map: MlMap): void {
  registerContextIcons(map);
  const add = (name: string, make: () => ImageData | null) => { if (map.hasImage(name)) return; const image = make(); if (image) map.addImage(name, image, { pixelRatio: 2 }); };
  for (const band of BANDS_ASC) add(`im-c-${band}`, () => filled(BAND_COLOR[band], BAND_SHAPE[band]));
  // Closed records are neutral: grey hollow marker with a check mark.
  add("im-c-closed", () => draw((g) => { shape(g, "circle"); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 4; g.strokeStyle = "#94a3b8"; g.stroke(); check(g, "#64748b"); }));
  add("im-square", () => filled("#c2410c", "square"));
  add("im-badge-warn", () => draw((g) => { shape(g, "triangle"); g.fillStyle = "#b91c1c"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke(); g.fillStyle = "#ffffff"; g.fillRect(C - 2.2, 18, 4.4, 12); g.fillRect(C - 2.2, 33, 4.4, 4.4); }));
  add("im-badge-check", () => draw((g) => { g.beginPath(); g.arc(C, C, 17, 0, Math.PI * 2); g.fillStyle = "#334155"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke(); check(g, "#ffffff"); }));
  add("im-badge-pause", () => draw((g) => { g.beginPath(); g.arc(C, C, 17, 0, Math.PI * 2); g.fillStyle = "#64748b"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke(); g.fillStyle = "#ffffff"; g.fillRect(16, 14, 6, 20); g.fillRect(27, 14, 6, 20); }));
}

/* ---------- Batch 02 sprites: asset type + condition, utility hexagons, hazard hatch patterns, project-risk rings ---------- */

export const ASSET_TYPE_GLYPH: Record<string, string> = { ROAD: "R", BRIDGE: "B", BUILDING: "H", PUBLIC_FACILITY: "F", OTHER: "•" };
/** Five-step ramp; shape, ring and badge carry the condition as well, so it is never colour-only. */
export const CONDITION_COLOR: Record<string, string> = { EXCELLENT: "#15803d", GOOD: "#65a30d", FAIR: "#ca8a04", POOR: "#ea580c", CRITICAL: "#b91c1c", UNKNOWN: "#64748b" };
export const UTILITY_COLOR: Record<string, string> = { water: "#1d4ed8", drainage: "#0f766e", electricity: "#b45309", telecom: "#7c3aed" };
export const HAZARD_LEVEL_COLOR: Record<string, string> = { LOW: "#ca8a04", MEDIUM: "#ea580c", HIGH: "#dc2626", VERY_HIGH: "#7f1d1d" };
export const RISK_BAND_COLOR: Record<string, string> = { LOW: "#3E9B7A", MEDIUM: "#E0A526", HIGH: "#8D153A" };

type Paint = (g: CanvasRenderingContext2D) => void;

/** Asset marker: filled disc in the condition colour, type letter, and a ring/badge variant per condition. */
export const paintAsset = (type: string, condition: string): Paint => (g) => {
  const color = CONDITION_COLOR[condition] ?? CONDITION_COLOR.UNKNOWN!;
  g.beginPath(); g.arc(24, 24, 15, 0, Math.PI * 2);
  if (condition === "UNKNOWN") { g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 3.5; g.strokeStyle = color; g.stroke(); }
  else { g.fillStyle = color; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke(); }
  g.fillStyle = condition === "UNKNOWN" ? color : "#ffffff"; g.font = "bold 18px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(condition === "UNKNOWN" ? "?" : (ASSET_TYPE_GLYPH[type] ?? "•"), 24, 25);
  g.strokeStyle = color; g.lineWidth = 2.5;
  if (condition === "FAIR") { g.beginPath(); g.arc(24, 24, 21, Math.PI * 0.75, Math.PI * 1.75); g.stroke(); }
  if (condition === "POOR") { g.setLineDash([4, 3]); g.beginPath(); g.arc(24, 24, 21, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
  if (condition === "CRITICAL") { g.beginPath(); g.arc(24, 24, 20, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(24, 24, 23.5, 0, Math.PI * 2); g.stroke(); }
  if (condition === "POOR" || condition === "CRITICAL") { // "!" badge top right
    g.beginPath(); g.arc(39, 9, 8, 0, Math.PI * 2); g.fillStyle = "#b91c1c"; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke();
    g.fillStyle = "#fff"; g.font = "bold 12px sans-serif"; g.fillText("!", 39, 10);
  }
};

export const paintHexagon = (color: string): Paint => (g) => {
  g.beginPath();
  for (let i = 0; i < 6; i += 1) { const a = (Math.PI / 3) * i + Math.PI / 6; g.lineTo(24 + 16 * Math.cos(a), 24 + 16 * Math.sin(a)); }
  g.closePath(); g.fillStyle = color; g.fill(); g.lineWidth = 3.5; g.strokeStyle = "#ffffff"; g.stroke();
};

/** Hatch density rises with level: LOW sparse dots, MEDIUM diagonals, HIGH dense diagonals, VERY_HIGH cross-hatch. */
export const paintHatch = (level: string): Paint => (g) => {
  const color = HAZARD_LEVEL_COLOR[level] ?? "#dc2626";
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2;
  const diag = (step: number) => { for (let o = -SIZE; o <= SIZE * 2; o += step) { g.beginPath(); g.moveTo(o, 0); g.lineTo(o - SIZE, SIZE); g.stroke(); } };
  if (level === "LOW") { for (let x = 6; x < SIZE; x += 16) for (let y = 6; y < SIZE; y += 16) { g.beginPath(); g.arc(x + 4, y + 4, 2, 0, Math.PI * 2); g.fill(); } }
  else if (level === "MEDIUM") diag(16);
  else if (level === "HIGH") diag(8);
  else { diag(8); g.save(); g.translate(SIZE, 0); g.scale(-1, 1); diag(8); g.restore(); }
};

export const paintRiskRing = (band: string): Paint => (g) => {
  const color = RISK_BAND_COLOR[band] ?? "#64748b";
  g.beginPath(); g.arc(24, 24, 17, 0, Math.PI * 2); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 5; g.strokeStyle = color; g.stroke();
  g.fillStyle = color; g.font = "bold 20px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(band[0] ?? "?", 24, 25);
};

export const ASSET_TYPES_FOR_SPRITES = ["ROAD", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"] as const;
export const CONDITIONS_FOR_SPRITES = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL", "UNKNOWN"] as const;

/** Draws one of this batch's sprites into a canvas. The legend uses the same functions, so it matches the map exactly. */
export function drawSprite(canvas: HTMLCanvasElement, paint: Paint): void {
  canvas.width = SIZE; canvas.height = SIZE;
  const g = canvas.getContext("2d");
  if (g) { g.clearRect(0, 0, SIZE, SIZE); g.lineJoin = "round"; paint(g); }
}

export function registerContextIcons(map: MlMap): void {
  const add = (name: string, paint: Paint, pattern = false) => {
    if (map.hasImage(name)) return;
    const image = draw(paint);
    if (image) map.addImage(name, image, pattern ? { pixelRatio: 2 } : { pixelRatio: 2 });
  };
  for (const t of ASSET_TYPES_FOR_SPRITES) for (const c of CONDITIONS_FOR_SPRITES) add(`im-a-${t}-${c}`, paintAsset(t, c));
  for (const [cls, color] of Object.entries(UTILITY_COLOR)) add(`im-u-${cls}`, paintHexagon(color));
  for (const level of Object.keys(HAZARD_LEVEL_COLOR)) add(`im-h-${level}`, paintHatch(level), true);
  for (const band of Object.keys(RISK_BAND_COLOR)) add(`im-r-${band}`, paintRiskRing(band));
}
