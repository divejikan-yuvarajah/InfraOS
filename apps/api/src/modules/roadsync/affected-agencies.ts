/**
 * Step 72 affected-agency detection. Pure and deterministic: callers load the facts, this module decides
 * who is involved, why (reason codes), who must respond and who should plausibly lead.
 * Jurisdiction detection is not implemented: the Agency model has no jurisdiction data.
 */
import { RECORD, REQUIRED_ROLES, type AgencyRole, type ReasonCode } from "./conflict-record.rules.js";

export type PairSide = { type: "work_request" | "project" | "asset"; id: string; agencyId: string; infrastructureType: string; submittedAt: Date | null };
export type AssetFact = { id: string; agencyId: string; infrastructureType: string; distanceMeters: number; intersectsFootprint: boolean };
export type NearbyWorkFact = { agencyId: string; id: string; ref: string; distanceMeters: number; start: Date; end: Date };
export type PairContext = {
  a: PairSide;
  b: PairSide;
  overlapWindow: { start: Date; end: Date } | null;
  /** Largest safety buffer of the two sides; the asset reach is max(this, ASSET_MIN_RADIUS_M). */
  bufferMeters: number;
  assets: AssetFact[];
  nearbyWork: NearbyWorkFact[];
};
export type ViaRef = { type: string; id: string };
export type AffectedAgency = {
  agencyId: string;
  roles: AgencyRole[];
  reasons: { code: ReasonCode; params: Record<string, unknown> }[];
  required: boolean;
  via: ViaRef[];
};
export type LeadReason = "lead_road_owner" | "lead_first_submitted";
export type Detection = { agencies: AffectedAgency[]; suggestedLead: { agencyId: string; reasonCode: LeadReason } | null; internal: boolean; truncated: boolean };

const DAY_MS = 86_400_000;

export function detectAffectedAgencies(ctx: PairContext): Detection {
  const map = new Map<string, AffectedAgency>();
  const order: string[] = [];
  const add = (agencyId: string, role: AgencyRole, code: ReasonCode, params: Record<string, unknown>, via: ViaRef) => {
    let entry = map.get(agencyId);
    if (!entry) {
      entry = { agencyId, roles: [], reasons: [], required: false, via: [] };
      map.set(agencyId, entry);
      order.push(agencyId);
    }
    if (!entry.roles.includes(role)) entry.roles.push(role);
    entry.reasons.push({ code, params });
    if (!entry.via.some((v) => v.type === via.type && v.id === via.id)) entry.via.push(via);
  };

  add(ctx.a.agencyId, "requesting", "owns_this_request", {}, { type: ctx.a.type, id: ctx.a.id });
  add(ctx.b.agencyId, "counterpart", "owns_other_request", {}, { type: ctx.b.type, id: ctx.b.id });
  const parties = new Set([ctx.a.agencyId, ctx.b.agencyId]);

  const reach = Math.max(ctx.bufferMeters, RECORD.ASSET_MIN_RADIUS_M);
  const assetGroups = new Map<string, { infrastructureType: string; count: number; firstId: string }>();
  for (const asset of [...ctx.assets].sort((x, y) => x.id.localeCompare(y.id))) {
    if (!asset.intersectsFootprint && asset.distanceMeters > reach) continue;
    const g = assetGroups.get(asset.agencyId);
    if (g) g.count += 1;
    else assetGroups.set(asset.agencyId, { infrastructureType: asset.infrastructureType, count: 1, firstId: asset.id });
  }
  for (const agencyId of [...assetGroups.keys()].sort()) {
    const g = assetGroups.get(agencyId)!;
    add(agencyId, "asset_owner", "owns_asset_in_footprint", { assetCount: g.count, infrastructureType: g.infrastructureType }, { type: "asset", id: g.firstId });
  }

  if (ctx.overlapWindow) {
    const lo = ctx.overlapWindow.start.getTime() - RECORD.THIRD_PARTY_WINDOW_DAYS * DAY_MS;
    const hi = ctx.overlapWindow.end.getTime() + RECORD.THIRD_PARTY_WINDOW_DAYS * DAY_MS;
    const near = ctx.nearbyWork
      .filter((w) => !parties.has(w.agencyId) && w.distanceMeters <= RECORD.THIRD_PARTY_RADIUS_M && w.start.getTime() <= hi && w.end.getTime() >= lo)
      .sort((x, y) => x.distanceMeters - y.distanceMeters || x.id.localeCompare(y.id));
    const seen = new Set<string>();
    for (const w of near) {
      if (seen.has(w.agencyId)) continue; // one reason per agency: the closest item
      seen.add(w.agencyId);
      add(w.agencyId, "third_party", "third_party_work_nearby", { requestRef: w.ref, distanceMeters: Math.round(w.distanceMeters) }, { type: "work_request", id: w.id });
    }
  }

  const internal = ctx.a.agencyId === ctx.b.agencyId;
  // Priority: parties, asset owners, third parties (already by proximity); stable by insertion order.
  const rank = (e: AffectedAgency) => (e.roles.includes("requesting") || e.roles.includes("counterpart") ? 0 : e.roles.includes("asset_owner") ? 1 : 2);
  const sorted = order.map((id, i) => ({ e: map.get(id)!, i })).sort((x, y) => rank(x.e) - rank(y.e) || x.i - y.i).map((x) => x.e);
  for (const e of sorted) e.required = e.roles.some((r) => REQUIRED_ROLES.includes(r));
  return { agencies: sorted.slice(0, RECORD.MAX_AFFECTED_AGENCIES), suggestedLead: internal ? null : suggestLead(ctx), internal, truncated: sorted.length > RECORD.MAX_AFFECTED_AGENCIES };
}

function suggestLead(ctx: PairContext): Detection["suggestedLead"] {
  const aRoad = ctx.a.infrastructureType === "ROAD";
  const bRoad = ctx.b.infrastructureType === "ROAD";
  if (aRoad !== bRoad) return { agencyId: aRoad ? ctx.a.agencyId : ctx.b.agencyId, reasonCode: "lead_road_owner" };
  const ta = ctx.a.submittedAt?.getTime() ?? Infinity;
  const tb = ctx.b.submittedAt?.getTime() ?? Infinity;
  if (ta !== tb) return { agencyId: ta < tb ? ctx.a.agencyId : ctx.b.agencyId, reasonCode: "lead_first_submitted" };
  return { agencyId: ctx.a.agencyId < ctx.b.agencyId ? ctx.a.agencyId : ctx.b.agencyId, reasonCode: "lead_first_submitted" };
}
