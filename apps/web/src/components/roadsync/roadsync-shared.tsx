import type { WorkPriority, WorkType } from "@infraos/shared-types";
import {
  DropletsIcon,
  LandmarkIcon,
  PickaxeIcon,
  RadioTowerIcon,
  RouteIcon,
  ShapesIcon,
  WaypointsIcon,
  WrenchIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import { PRIORITY_LABELS, summarizeGeometry, type GeometryInput } from "@/lib/roadsync/work-requests-view";

import "@/styles/mission-control-roadsync.css";
import "@/styles/mission-control-roadsync-risk.css";
import "@/styles/mission-control-roadsync-records.css";

export const WORK_TYPE_ICONS: Record<WorkType, LucideIcon> = {
  ROAD_RESURFACING: RouteIcon,
  ROAD_EXCAVATION: PickaxeIcon,
  PIPELINE_INSTALLATION: WaypointsIcon,
  ELECTRIC_CABLE_WORK: ZapIcon,
  TELECOM_CABLE_WORK: RadioTowerIcon,
  DRAINAGE_WORK: DropletsIcon,
  UTILITY_REPAIR: WrenchIcon,
  BRIDGE_WORK: LandmarkIcon,
  OTHER: ShapesIcon,
};

export function WorkTypeIcon({ type }: { type: WorkType }) {
  const Icon = WORK_TYPE_ICONS[type];
  return (
    <span className="rs-icon" aria-hidden="true">
      <Icon />
    </span>
  );
}

export function PriorityMark({ priority }: { priority: WorkPriority }) {
  return (
    <span className="rs-pri" data-p={priority}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/**
 * Schematic only: vertices are scaled into the box, with no basemap and no distance claim.
 * A text equivalent is always rendered next to it.
 */
export function GeometryPreview({ geometry }: { geometry: GeometryInput }) {
  const s = summarizeGeometry(geometry);
  const W = 320;
  const H = 140;
  const pad = 18;
  const spanLon = s.bounds.maxLon - s.bounds.minLon;
  const spanLat = s.bounds.maxLat - s.bounds.minLat;
  const scale = Math.min((W - pad * 2) / (spanLon || 1), (H - pad * 2) / (spanLat || 1));
  const cx = (W - spanLon * scale) / 2;
  const cy = (H - spanLat * scale) / 2;
  const pts = s.outline.map(([lon, lat]) => [spanLon ? cx + (lon - s.bounds.minLon) * scale : W / 2, spanLat ? H - cy - (lat - s.bounds.minLat) * scale : H / 2] as const);
  const path = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg className="rs-preview" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.label} with ${s.vertices} ${s.vertices === 1 ? "vertex" : "vertices"}. Schematic, not to scale.`}>
      <defs>
        <pattern id="rs-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#rs-grid)" />
      {s.kind === "Polygon" ? <polygon points={path} fill="rgb(255 91 0 / 0.14)" stroke="#b63d00" strokeWidth="2.5" strokeLinejoin="round" /> : null}
      {s.kind === "LineString" ? <polyline points={path} fill="none" stroke="#b63d00" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={s.kind === "Point" ? 7 : 4} fill="#fff" stroke="#111827" strokeWidth="2" />
      ))}
    </svg>
  );
}
