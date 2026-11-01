import type { WorkPriority, WorkStatus, WorkType } from "@infraos/shared-types";

/**
 * Local literals typed against shared-types: the web bundler cannot resolve runtime
 * imports from that package, so a parity test guards against drift.
 */
export const WORK_TYPES = ["ROAD_RESURFACING", "ROAD_EXCAVATION", "PIPELINE_INSTALLATION", "ELECTRIC_CABLE_WORK", "TELECOM_CABLE_WORK", "DRAINAGE_WORK", "UTILITY_REPAIR", "BRIDGE_WORK", "OTHER"] as const satisfies readonly WorkType[];
export const WORK_STATUSES = ["DRAFT", "SUBMITTED", "PLANNED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"] as const satisfies readonly WorkStatus[];
export const WORK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const satisfies readonly WorkPriority[];

/** Wire shape returned by /api/v1/roadsync/work-requests: WorkRequestDto plus read-only display context. */
export type WorkRequestRecord = {
  id: string;
  projectId: string;
  agencyId: string;
  projectTitle: string | null;
  projectCode: string | null;
  agencyName: string | null;
  workType: WorkType;
  status: WorkStatus;
  priority: WorkPriority;
  plannedStart: string;
  plannedEnd: string;
  geometry: GeometryInput;
  createdAt: string;
  updatedAt: string;
  revision: number;
  detection?: { status: "pending" | "running" | "completed" | "failed"; completedAt: string | null; counts: { nearby: number; candidates: number; agencies: number; truncated: boolean } | null } | null;
  nearbyCount: number;
};

export type WorkRequestListData = {
  workRequests: WorkRequestRecord[];
  page: number;
  limit: number;
  total: number;
  counts: { byStatus: Record<string, number>; byPriority: Record<string, number> };
};

export type Position = [number, number];
export type GeometryInput =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "Polygon"; coordinates: Position[][] };

export type GeometryKind = GeometryInput["type"];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  ROAD_RESURFACING: "Road resurfacing",
  ROAD_EXCAVATION: "Road excavation",
  PIPELINE_INSTALLATION: "Pipeline installation",
  ELECTRIC_CABLE_WORK: "Electric cable work",
  TELECOM_CABLE_WORK: "Telecom cable work",
  DRAINAGE_WORK: "Drainage work",
  UTILITY_REPAIR: "Utility repair",
  BRIDGE_WORK: "Bridge work",
  OTHER: "Other work",
};

export const PRIORITY_LABELS: Record<WorkPriority, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", CRITICAL: "Critical" };

export function statusLabel(status: string): string {
  const spaced = status.replaceAll("_", " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Work-request planning is offered only for projects the API will accept. */
export const ELIGIBLE_PROJECT_STATUSES = ["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED"] as const;

/* ---------- geometry ---------- */

export type GeometryParse = { ok: true; geometry: GeometryInput } | { ok: false; error: string };

function pair(line: string): Position | null {
  const parts = line.split(/[\s,;]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

/** Coordinates are entered as longitude, latitude (GeoJSON order), one vertex per line. */
export function parseGeometryText(kind: GeometryKind, text: string): GeometryParse {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, error: "Enter at least one coordinate as longitude, latitude." };
  const points: Position[] = [];
  for (const [index, line] of lines.entries()) {
    const parsed = pair(line);
    if (!parsed) return { ok: false, error: `Line ${index + 1} must be two numbers: longitude, latitude.` };
    if (Math.abs(parsed[0]) > 180) return { ok: false, error: `Line ${index + 1}: longitude must be between -180 and 180.` };
    if (Math.abs(parsed[1]) > 90) return { ok: false, error: `Line ${index + 1}: latitude must be between -90 and 90 (longitude comes first).` };
    points.push(parsed);
  }
  if (kind === "Point") {
    if (points.length !== 1) return { ok: false, error: "A point needs exactly one coordinate." };
    return { ok: true, geometry: { type: "Point", coordinates: points[0] as Position } };
  }
  if (points.length > 500) return { ok: false, error: "Use at most 500 vertices." };
  if (kind === "LineString") {
    if (points.length < 2) return { ok: false, error: "A line needs at least two coordinates." };
    return { ok: true, geometry: { type: "LineString", coordinates: points } };
  }
  const first = points[0] as Position;
  const last = points[points.length - 1] as Position;
  const ring = first[0] === last[0] && first[1] === last[1] ? points : [...points, first];
  if (ring.length < 4) return { ok: false, error: "An area needs at least three distinct corners." };
  return { ok: true, geometry: { type: "Polygon", coordinates: [ring] } };
}

function haversineKm(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GeometrySummary = {
  kind: GeometryKind;
  label: string;
  vertices: number;
  lengthKm: number | null;
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number };
  /** Vertices for the schematic preview; the Polygon ring omits its repeated closing vertex. */
  outline: Position[];
};

export function summarizeGeometry(g: GeometryInput): GeometrySummary {
  const outline = g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : (g.coordinates[0] ?? []).slice(0, -1);
  const all = g.type === "Polygon" ? g.coordinates.flat() : outline;
  const lons = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  let length = 0;
  if (g.type === "LineString") for (let i = 1; i < g.coordinates.length; i += 1) length += haversineKm(g.coordinates[i - 1] as Position, g.coordinates[i] as Position);
  return {
    kind: g.type,
    label: g.type === "Point" ? "Point location" : g.type === "LineString" ? "Corridor line" : "Work area",
    vertices: outline.length,
    lengthKm: g.type === "LineString" ? length : null,
    bounds: { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) },
    outline,
  };
}

export function formatPosition(p: Position): string {
  return `${p[1].toFixed(5)}°N, ${p[0].toFixed(5)}°E`;
}

/* ---------- dates (Sri Lanka has no DST: fixed +05:30) ---------- */

const COLOMBO_OFFSET = "+05:30";

/** Converts a datetime-local value, read as Asia/Colombo time, to a UTC ISO instant. */
export function colomboLocalToUtc(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${COLOMBO_OFFSET}`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject rollovers such as 2026-02-30.
  const back = new Date(date.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16);
  return back === value ? date.toISOString() : null;
}

export function formatColombo(iso: string, withTime = true): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

export function formatWindow(startIso: string, endIso: string): string {
  return `${formatColombo(startIso)} → ${formatColombo(endIso)}`;
}

/* ---------- create form ---------- */

export type WorkRequestFormValues = {
  projectId: string;
  workType: string;
  priority: string;
  geometryKind: GeometryKind;
  coordinates: string;
  plannedStart: string;
  plannedEnd: string;
};

export type WorkRequestFormErrors = Partial<Record<keyof WorkRequestFormValues, string>>;

export type CreateWorkRequestBody = {
  projectId: string;
  workType: WorkType;
  priority: WorkPriority;
  plannedStart: string;
  plannedEnd: string;
  geometry: GeometryInput;
};

export const FORM_FIELD_ORDER: (keyof WorkRequestFormValues)[] = ["projectId", "workType", "priority", "coordinates", "plannedStart", "plannedEnd"];

export const EMPTY_FORM: WorkRequestFormValues = {
  projectId: "",
  workType: "",
  priority: "NORMAL",
  geometryKind: "LineString",
  coordinates: "",
  plannedStart: "",
  plannedEnd: "",
};

export function buildCreateBody(values: WorkRequestFormValues): { ok: true; body: CreateWorkRequestBody } | { ok: false; errors: WorkRequestFormErrors } {
  const errors: WorkRequestFormErrors = {};
  if (!/^[a-f0-9]{24}$/i.test(values.projectId)) errors.projectId = "Choose the project this work belongs to.";
  if (!(WORK_TYPES as readonly string[]).includes(values.workType)) errors.workType = "Choose a work type.";
  if (!(WORK_PRIORITIES as readonly string[]).includes(values.priority)) errors.priority = "Choose a priority.";
  const geometry = parseGeometryText(values.geometryKind, values.coordinates);
  if (!geometry.ok) errors.coordinates = geometry.error;
  const start = colomboLocalToUtc(values.plannedStart);
  const end = colomboLocalToUtc(values.plannedEnd);
  if (!start) errors.plannedStart = "Enter a valid start date and time.";
  if (!end) errors.plannedEnd = "Enter a valid end date and time.";
  if (start && end && new Date(end) < new Date(start)) errors.plannedEnd = "End must be on or after the start.";
  if (Object.keys(errors).length > 0 || !geometry.ok || !start || !end) return { ok: false, errors };
  return {
    ok: true,
    body: {
      projectId: values.projectId,
      workType: values.workType as WorkType,
      priority: values.priority as WorkPriority,
      plannedStart: start,
      plannedEnd: end,
      geometry: geometry.geometry,
    },
  };
}

export function firstInvalidField(errors: WorkRequestFormErrors): keyof WorkRequestFormValues | null {
  return FORM_FIELD_ORDER.find((field) => errors[field]) ?? null;
}

/* ---------- list ---------- */

export type WorkRequestFilters = { status: string; workType: string; priority: string; projectId: string; page: number; hasCandidates?: boolean };
export const EMPTY_FILTERS: WorkRequestFilters = { status: "", workType: "", priority: "", projectId: "", page: 1 };

export function filtersToQuery(f: WorkRequestFilters, limit = 20): string {
  const params = new URLSearchParams({ page: String(f.page), limit: String(limit) });
  if (f.status) params.set("status", f.status);
  if (f.workType) params.set("workType", f.workType);
  if (f.priority) params.set("priority", f.priority);
  if (f.projectId) params.set("projectId", f.projectId);
  if (f.hasCandidates) params.set("hasCandidates", "true");
  return params.toString();
}

export function hasActiveFilters(f: WorkRequestFilters): boolean {
  return Boolean(f.status || f.workType || f.priority || f.projectId || f.hasCandidates);
}

/** Roles whose server grant includes roadsync.work_request.create. A hint only: the API enforces it. */
export function canHintCreate(roleKey: string): boolean {
  return roleKey === "SUPER_ADMIN" || roleKey === "GOV_ADMIN" || roleKey === "AGENCY_OFFICER" || roleKey === "PROJECT_MANAGER";
}

/** Session-scoped key so one user's cached records are never shown to another. */
export function workRequestQueryKey(epoch: string, userId: string, roleKey: string, ...rest: unknown[]) {
  return ["roadsync", "work-requests", epoch, userId, roleKey, ...rest] as const;
}
