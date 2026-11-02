import type { Band, ClassCode } from "./assessment";

/** Steps 72-73 read models, exactly as the API sends them. Display text is always composed client-side. */
export type RecordStatus = "open" | "acknowledged" | "awaiting_response" | "negotiating" | "escalated" | "resolved" | "dismissed" | "auto_closed" | "withdrawn";
export type AgencyRole = "requesting" | "counterpart" | "asset_owner" | "third_party";
export type AckStatus = "pending" | "acknowledged";
export type Snap = { score: number; band: Band; primaryClass: ClassCode | null; classes: ClassCode[]; kind: "conflict" | "opportunity"; overridden: boolean };

export type Party = {
  sourceType: "work_request" | "project" | "asset";
  id: string;
  ref: string;
  title: string;
  agencyId: string;
  agencyName: string | null;
  infrastructureType: string;
  workType: string | null;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  detailLevel: "full" | "redacted";
  canOpen: boolean;
  mine: boolean;
  geometry: unknown;
};
export type TimeToImpact = { state: "upcoming" | "active" | "ended" | "none"; days: number | null; dayIndex: number | null; totalDays: number | null };

export type RecordRow = {
  id: string;
  conflictNo: string;
  recordType: "conflict" | "opportunity";
  status: RecordStatus;
  severity: Snap;
  parties: { a: Party; b: Party };
  affectedAgencies: { agencyId: string; agencyName: string | null; roles: AgencyRole[]; required: boolean; ackStatus: AckStatus; active: boolean }[];
  myAgency: { agencyId: string; roles: AgencyRole[]; required: boolean; ackStatus: AckStatus; ackDueAt: string | null; overdue: boolean } | null;
  lead: { agencyId: string; agencyName: string | null; source: "suggested" | "national"; reasonCode: string } | null;
  timeToImpact: TimeToImpact;
  overlapWindow: { start: string | null; end: string | null } | null;
  ackProgress: { done: number; required: number };
  belowThreshold: boolean;
  internal: boolean;
  unseenChanges: number;
  watching: boolean;
  hotspot: { type: "Point"; coordinates: [number, number] };
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
};
export type RecordList = { items: RecordRow[]; total: number; page: number; limit: number };
export type RecordSummary = { needsMyAck: number; overdue: number; byBand: Record<Band, number>; byStatus: Record<string, number>; startingIn14d: number; opportunities: number; watching: number; criticalHigh: number; capped: boolean };

export type AffectedView = {
  agencyId: string;
  agencyName: string | null;
  roles: AgencyRole[];
  required: boolean;
  source: "auto" | "manual";
  active: boolean;
  inactiveReason: string | null;
  excluded: { at: string | null; reason?: string } | null;
  reasons: { code: string; params: Record<string, unknown> }[];
  ack: { status: AckStatus; at: string | null; byRole: string | null; onBehalf: boolean; byName?: string | null };
  ackDueAt: string | null;
  addedAt: string | null;
};
export type EventView = { id: string; at: string; type: string; data: Record<string, unknown>; actor: { kind: "system" } | { kind: "user"; agencyId: string | null; agencyName: string | null; name?: string | null } };
export type HistoryPoint = { at: string; score: number; band: Band; ruleVersion: string; reason: "detected" | "reassessed" | "override" | "override_cleared" };
export type FactorView = { key: string; points: number; max: number; code: string; params: Record<string, unknown>; sensitive?: boolean };
export type NoteView = { id: string; agencyId: string; agencyName: string | null; authorName: string | null; text: string; createdAt: string; mine: boolean };

export type Dossier = Omit<RecordRow, "unseenChanges"> & {
  unseenChanges: number;
  statusReason: string | null;
  statusChangedAt: string | null;
  closedAt: string | null;
  severityDetail: { current: Snap; atDetection: Snap & { ruleVersion: string; assessedAt: string | null; factorsSnapshot: FactorView[]; agencyCount: number }; history: HistoryPoint[] };
  assessment: { ruleVersion: string; factors: FactorView[]; mitigations: { key: string; points: number; params: Record<string, unknown> }[]; floorApplied: { code: string; min: number } | null; sequence: unknown; incompleteInputs: string[]; inputsAssumed: string[]; estimatedSharedTrenchMeters: number | null; overridden: boolean; overrideStale: boolean } | null;
  spatial: { distanceMeters: number; relation: string; sharedLengthMeters: number } | null;
  temporal: { relation: string; overlapDays: number; overlapStart: string | null; overlapEnd: string | null } | null;
  pairActive: boolean;
  affected: AffectedView[];
  notes: NoteView[];
  events: EventView[];
  related: RecordRow[];
  diffSinceLastSeen: { newEvents: number; severityDelta: { from: { score: number; band: Band }; to: { score: number; band: Band } } | null; agenciesAdded: number; statusChanged: { from: RecordStatus; to: RecordStatus } | null } | null;
  watchers: number;
  canAct: { acknowledge: boolean; dismiss: boolean; reopen: boolean; setLead: boolean; manageAgencies: boolean; note: boolean };
};

export type BulkResult = { id: string; result: "ok" | "already" | "forbidden" | "not_found" | "stale" | "invalid" };

// ---------- pure helpers ----------

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const IMPLEMENTED_LIFECYCLE: RecordStatus[] = ["open", "acknowledged"];
export const SIDE_EXITS: RecordStatus[] = ["dismissed", "auto_closed"];

export type SlaState = { kind: "none" } | { kind: "later"; hours: number } | { kind: "today" } | { kind: "overdue"; days: number; hours: number };

/** Client-side SLA clock. "Due today" means within 12 hours; overdue is measured from the due time. */
export function slaState(ackDueAt: string | null, now: number): SlaState {
  if (!ackDueAt) return { kind: "none" };
  const diff = new Date(ackDueAt).getTime() - now;
  if (diff < 0) return { kind: "overdue", days: Math.floor(-diff / DAY), hours: Math.ceil(-diff / HOUR) };
  if (diff <= 12 * HOUR) return { kind: "today" };
  return { kind: "later", hours: Math.ceil(diff / HOUR) };
}

/** Fraction of the final 30 days still remaining before overlap start (1 = 30+ days away, 0 = starting now). */
export const ringFraction = (days: number | null) => (days === null ? 0 : Math.max(0, Math.min(1, days / 30)));
export const impactTone = (t: TimeToImpact): "calm" | "soon" | "urgent" | "active" | "ended" | "none" =>
  t.state === "upcoming" ? ((t.days ?? 99) < 3 ? "urgent" : (t.days ?? 99) < 14 ? "soon" : "calm") : t.state;

export const bandRank = (b: Band) => (["info", "low", "medium", "high", "critical"] as const).indexOf(b);

// ---------- presets and filters (plain URL query; nothing is persisted) ----------

export type Preset = "needsMyAck" | "overdue" | "criticalHigh" | "soon" | "opportunities" | "watching" | "mine" | "unassigned" | "dismissed" | "autoClosed" | "all";
export const PRESET_QUERY: Record<Preset, Record<string, string>> = {
  needsMyAck: { needsMyAck: "true", status: "open" },
  overdue: { ackOverdue: "true" },
  criticalHigh: { band: "critical,high", status: "open,acknowledged" },
  soon: { startsWithinDays: "14", status: "open,acknowledged", sort: "timeToImpact" },
  opportunities: { recordType: "opportunity" },
  watching: { watching: "true" },
  mine: { status: "open,acknowledged" },
  unassigned: { status: "open,acknowledged" },
  dismissed: { status: "dismissed" },
  autoClosed: { status: "auto_closed" },
  all: {},
};
export const FILTER_KEYS = ["status", "band", "class", "recordType", "agencyId", "q", "internal", "needsMyAck", "ackOverdue", "startsWithinDays", "watching", "requestId", "sort"] as const;

export function presetOf(params: URLSearchParams): Preset | null {
  const p = params.get("preset");
  return p && p in PRESET_QUERY ? (p as Preset) : null;
}

/** API query for the current URL. A preset supplies defaults; explicit filters in the URL win. */
export function apiQuery(params: URLSearchParams, page: number, limit: number): string {
  const out = new URLSearchParams();
  const preset = presetOf(params);
  for (const [k, v] of Object.entries(preset ? PRESET_QUERY[preset] : { status: "open,acknowledged" })) out.set(k, v);
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) out.set(key, value);
  }
  out.set("page", String(page));
  out.set("limit", String(limit));
  return out.toString();
}

export const csvOf = (params: URLSearchParams, key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
export const initials = (name: string | null) => (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
export const roleWeight: Record<AgencyRole, number> = { requesting: 3, counterpart: 3, asset_owner: 2, third_party: 1 };
export const orbitOf = (roles: AgencyRole[]): 0 | 1 | 2 => (roles.includes("requesting") || roles.includes("counterpart") ? 0 : roles.includes("asset_owner") ? 1 : 2);

/** Step line for the severity sparkline: one point per history entry, held flat until the next. */
export function stepPath(points: HistoryPoint[], w: number, h: number, now = Date.now()): string {
  if (!points.length) return "";
  const t0 = new Date(points[0]!.at).getTime();
  const span = Math.max(now - t0, 1);
  const x = (t: number) => ((t - t0) / span) * w;
  const y = (s: number) => h - (s / 100) * h;
  let d = `M0 ${y(points[0]!.score).toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const px = x(new Date(points[i]!.at).getTime());
    d += ` H${px.toFixed(1)} V${y(points[i]!.score).toFixed(1)}`;
  }
  return `${d} H${w}`;
}
