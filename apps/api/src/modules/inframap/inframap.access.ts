/**
 * Pure access policy and derivations for the Batch 02 layers. Nothing here touches the database or the request, so
 * the whole policy is unit-tested directly. The query side (`visibleAssetFilter`) builds a MongoDB filter so that
 * restricted geometry is excluded by the database, never filtered in the browser or after the fact.
 *
 * Layer classification: the Assets layer is assetType in ROAD, BRIDGE, BUILDING, PUBLIC_FACILITY, OTHER; the
 * Utilities layer is WATER, DRAINAGE, ELECTRICITY, TELECOM. `LAYER_OF_ASSET_TYPE` is the single source of truth.
 */

export type AssetType = "ROAD" | "WATER" | "ELECTRICITY" | "TELECOM" | "DRAINAGE" | "BRIDGE" | "BUILDING" | "PUBLIC_FACILITY" | "OTHER";
export type AssetLayerId = "assets" | "utilities";
export type Sensitivity = "STANDARD" | "RESTRICTED";
export type Tier = "FULL" | "AWARENESS" | "HIDDEN";

export const UTILITY_TYPES = ["WATER", "DRAINAGE", "ELECTRICITY", "TELECOM"] as const;
export const ASSET_LAYER_TYPES = ["ROAD", "BRIDGE", "BUILDING", "PUBLIC_FACILITY", "OTHER"] as const;
export const LAYER_OF_ASSET_TYPE: Record<AssetType, AssetLayerId> = {
  ROAD: "assets", BRIDGE: "assets", BUILDING: "assets", PUBLIC_FACILITY: "assets", OTHER: "assets",
  WATER: "utilities", DRAINAGE: "utilities", ELECTRICITY: "utilities", TELECOM: "utilities",
};
export const UTILITY_CLASS: Record<string, "water" | "drainage" | "electricity" | "telecom"> = { WATER: "water", DRAINAGE: "drainage", ELECTRICITY: "electricity", TELECOM: "telecom" };

/**
 * THE policy knob. "AWARENESS": another agency's STANDARD feature is visible with reduced detail.
 * "HIDDEN": strict own-agency-only (the feature is excluded in the query and not counted for the viewer).
 */
export const CROSS_AGENCY_STANDARD_TIER: "AWARENESS" | "HIDDEN" = "AWARENESS";

/** Explicit value wins. Otherwise utility types are RESTRICTED and everything else STANDARD (secure by default). */
export function effectiveSensitivity(asset: { assetType: string; sensitivity?: string | null }): Sensitivity {
  if (asset.sensitivity === "RESTRICTED" || asset.sensitivity === "STANDARD") return asset.sensitivity;
  return (UTILITY_TYPES as readonly string[]).includes(asset.assetType) ? "RESTRICTED" : "STANDARD";
}

export type Viewer = {
  /** Platform-level scope (super admin). */
  platform: boolean;
  /** Agencies the viewer owns through resolveResourceScope; empty for roles with no agency scope. */
  agencyIds: readonly string[];
  canRestricted: boolean;
  canHealth: boolean;
};

export function tierOf(viewer: Viewer, feature: { agencyId: string | null; sensitivity: Sensitivity }): Tier {
  const own = viewer.platform || (feature.agencyId !== null && viewer.agencyIds.includes(feature.agencyId));
  if (feature.sensitivity === "RESTRICTED") return viewer.canRestricted && own ? "FULL" : "HIDDEN";
  return own ? "FULL" : CROSS_AGENCY_STANDARD_TIER;
}

/** Mongo expression for "effectively RESTRICTED". `sensitivity: null` matches a missing field. */
export const RESTRICTED_MATCH = {
  $or: [{ sensitivity: "RESTRICTED" }, { sensitivity: null, assetType: { $in: [...UTILITY_TYPES] } }],
};

/** Filter for the assets the viewer may receive at tier FULL or AWARENESS. Restricted rows the viewer may not see are not matched. */
export function visibleAssetFilter(viewer: Viewer): Record<string, unknown> {
  const standard = { $nor: [RESTRICTED_MATCH] };
  const ownOnly = { agencyId: { $in: [...viewer.agencyIds] } };
  const standardVisible = viewer.platform || CROSS_AGENCY_STANDARD_TIER === "AWARENESS" ? standard : { $and: [standard, ownOnly] };
  const branches: Record<string, unknown>[] = [standardVisible];
  if (viewer.canRestricted) branches.push(viewer.platform ? RESTRICTED_MATCH : { $and: [RESTRICTED_MATCH, ownOnly] });
  return { $or: branches };
}

/** Restricted rows in the layer the viewer is NOT allowed to see: only their count is ever returned. */
export function hiddenRestrictedFilter(viewer: Viewer): Record<string, unknown> {
  return { $and: [RESTRICTED_MATCH, { $nor: [visibleAssetFilter(viewer)] }] };
}

export type AssetFacts = {
  condition: string; nextMaintenanceAt?: Date | null; lastInspectionAt?: Date | null; commissionedAt?: Date | null;
};
export const ATTENTION_REASONS = ["CONDITION_POOR", "CONDITION_CRITICAL", "MAINTENANCE_OVERDUE", "INSPECTION_STALE"] as const;
export type AttentionReason = (typeof ATTENTION_REASONS)[number];
const DAY = 86_400_000;

/** Single attention rule: poor or critical condition, maintenance date passed, or inspection older than 365 days (or none for an asset commissioned over a year ago). */
export function attentionReasons(a: AssetFacts, now = new Date()): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (a.condition === "POOR") reasons.push("CONDITION_POOR");
  if (a.condition === "CRITICAL") reasons.push("CONDITION_CRITICAL");
  if (a.nextMaintenanceAt && a.nextMaintenanceAt.getTime() < now.getTime()) reasons.push("MAINTENANCE_OVERDUE");
  const last = a.lastInspectionAt?.getTime();
  if (last !== undefined ? now.getTime() - last > 365 * DAY : a.commissionedAt ? now.getTime() - a.commissionedAt.getTime() > 365 * DAY : false) reasons.push("INSPECTION_STALE");
  return reasons;
}

export const RISK_BANDS = [{ band: "LOW", below: 34 }, { band: "MEDIUM", below: 67 }, { band: "HIGH", below: 101 }] as const;
export function riskBand(overallRisk: number): "LOW" | "MEDIUM" | "HIGH" {
  return RISK_BANDS.find((b) => overallRisk < b.below)?.band ?? "HIGH";
}

type Geo = { type: string; coordinates: unknown };
/** One representative point: a Point itself, a LineString's middle vertex, a Polygon's outer-ring bbox centre. */
export function representativePoint(geometry: Geo | null | undefined): [number, number] | null {
  if (!geometry) return null;
  const c = geometry.coordinates as number[] | number[][] | number[][][];
  if (geometry.type === "Point" && Array.isArray(c) && typeof c[0] === "number") return [c[0] as number, c[1] as number];
  if (geometry.type === "LineString" && Array.isArray(c) && c.length) { const m = (c as number[][])[Math.floor((c.length - 1) / 2)]; return m ? [m[0]!, m[1]!] : null; }
  if (geometry.type === "Polygon" && Array.isArray(c) && Array.isArray(c[0])) {
    const ring = c[0] as number[][];
    const xs = ring.map((p) => p[0]!), ys = ring.map((p) => p[1]!);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  return null;
}

export type ProvenanceKind = "LIVE" | "OFFICIAL_PUBLIC" | "AGENCY_SUPPLIED" | "DEMO";
/** Provenance of an InfraOS asset record: a live record, or DEMO when it is a labelled seed record. */
export const assetProvenance = (isDemo: boolean): ProvenanceKind => (isDemo ? "DEMO" : "LIVE");

export type AssetRow = {
  id: string; assetType: string; name: string; condition: string; agencyId: string | null; agencyName: string | null;
  district: string | null; province: string | null; roadName: string | null; sensitivity: Sensitivity;
  healthScore: number | null; lastInspectionAt: Date | null; nextMaintenanceAt: Date | null; commissionedAt: Date | null;
  sourceProjectId: string | null; sourceProjectTitle: string | null; isDemo: boolean;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Allowlisted properties for one tier. AWARENESS keeps geometry-adjacent facts only: no health score, dates,
 * maintenance, source project or location text. Never spread a document.
 */
export function projectAssetProperties(row: AssetRow, layer: AssetLayerId, tier: Exclude<Tier, "HIDDEN">, viewer: Viewer, now = new Date()): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: row.id, layer, assetType: row.assetType, name: row.name, condition: row.condition,
    ...(tier === "FULL" ? { agencyId: row.agencyId } : {}), agencyName: row.agencyName, district: row.district, province: row.province,
    tier, provenance: assetProvenance(row.isDemo), isDemo: row.isDemo,
  };
  if (layer === "utilities") { base.utilityClass = UTILITY_CLASS[row.assetType] ?? null; base.sensitivity = row.sensitivity; }
  if (tier === "AWARENESS") return base;
  const reasons = attentionReasons(row, now);
  return {
    ...base, roadName: row.roadName, lastInspectionAt: iso(row.lastInspectionAt), nextMaintenanceAt: iso(row.nextMaintenanceAt),
    needsAttention: reasons.length > 0, attentionReasons: reasons,
    ...(viewer.canHealth ? { healthScore: row.healthScore } : {}),
    ...(row.sourceProjectId && row.sourceProjectTitle ? { sourceProjectId: row.sourceProjectId, sourceProjectTitle: row.sourceProjectTitle } : {}),
  };
}
