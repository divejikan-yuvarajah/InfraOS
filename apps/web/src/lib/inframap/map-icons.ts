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
  const add = (name: string, image: ImageData | null) => { if (image && !map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 }); };
  for (const band of BANDS_ASC) add(`im-c-${band}`, filled(BAND_COLOR[band], BAND_SHAPE[band]));
  // Closed records are neutral: grey hollow marker with a check mark.
  add("im-c-closed", draw((g) => { shape(g, "circle"); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 4; g.strokeStyle = "#94a3b8"; g.stroke(); check(g, "#64748b"); }));
  add("im-square", filled("#c2410c", "square"));
  add("im-badge-warn", draw((g) => { shape(g, "triangle"); g.fillStyle = "#b91c1c"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke(); g.fillStyle = "#ffffff"; g.fillRect(C - 2.2, 18, 4.4, 12); g.fillRect(C - 2.2, 33, 4.4, 4.4); }));
  add("im-badge-check", draw((g) => { g.beginPath(); g.arc(C, C, 17, 0, Math.PI * 2); g.fillStyle = "#334155"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke(); check(g, "#ffffff"); }));
  add("im-badge-pause", draw((g) => { g.beginPath(); g.arc(C, C, 17, 0, Math.PI * 2); g.fillStyle = "#64748b"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.stroke(); g.fillStyle = "#ffffff"; g.fillRect(16, 14, 6, 20); g.fillRect(27, 14, 6, 20); }));
}
