import mongoose from "mongoose";

import { DEMO_PROJECT_CODES } from "../../database/seeds/demo/catalog.js";
import { Agency } from "../agencies/models/agency.model.js";
import { Asset } from "../assets/models/asset.model.js";
import { MaintenanceRecord } from "../assets/models/maintenance-record.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { Role } from "../identity/models/role.model.js";
import { projectScopeFilter } from "../projects/projects.service.js";
import { Project } from "../projects/models/project.model.js";
import { HazardZone } from "../risk/models/hazard-zone.model.js";
import { RiskAssessment } from "../risk/models/risk-assessment.model.js";
import { accessFilter } from "../roadsync/conflict-record.read.js";
import { whoIs } from "../roadsync/conflict-record.service.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";
import { WorkRequest } from "../roadsync/models/work-request.model.js";
import { readFilter as workRequestFilter } from "../roadsync/work-requests.service.js";
import {
  ASSET_LAYER_TYPES, attentionReasons, effectiveSensitivity, hiddenRestrictedFilter, projectAssetProperties, representativePoint, riskBand,
  tierOf, UTILITY_TYPES, visibleAssetFilter, type AssetLayerId, type AssetRow, type Viewer,
} from "./inframap.access.js";
import { assetNarrow, hazardNarrow, projectNarrow, type LayerQ } from "./inframap.filters.js";
import { envelopeAround, geometryBounds, layerCollection, transportGeometry, viewportPolygon, type Bbox } from "./inframap.geo.js";
import type { LayerResult } from "./inframap.service.js";

/**
 * Batch 02: assets, utilities and risks, plus the exposure, nearby and detail lookups. Everything is read-only and
 * scoped in the query. Hazard exposure and proximity are informational spatial lookups: they never create, score
 * or classify RoadSync conflicts.
 */
export type Ctx = { viewer: Viewer; has: (permission: string) => boolean; ids: mongoose.Types.ObjectId[] };

const FORBIDDEN = { ok: false as const, status: 403 as const, code: "FORBIDDEN" };
const iso = (d: unknown) => (d ? new Date(d as string | number | Date).toISOString() : null);
const DEMO_CODES = new Set<string>(DEMO_PROJECT_CODES);
const LEVELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;

export async function contextOf(actor: AuthenticatedActor): Promise<Ctx> {
  const role = await Role.findById(actor.roleId).select("permissions isActive key");
  const granted = role?.isActive && role.key === actor.roleKey && Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
  const has = (permission: string) => hasPermission(granted, permission as never);
  const scope = await resolveResourceScope(actor);
  const ids = scope.kind === "agencies" ? scope.agencyIds : [];
  return {
    ids, has,
    viewer: { platform: scope.kind === "platform", agencyIds: ids.map(String), canRestricted: has("map.layer.restricted"), canHealth: has("asset.health.read") },
  };
}

export const hazardVisible = (ctx: Ctx): Record<string, unknown> =>
  ctx.viewer.platform ? {} : { $or: [{ visibility: "ALL_STAFF" }, { visibility: "AGENCY", agencyId: { $in: ctx.ids } }] };
const within = (bbox: Bbox) => ({ geometry: { $geoIntersects: { $geometry: viewportPolygon(bbox) } } });
export const layerTypes = (layer: AssetLayerId): readonly string[] => (layer === "assets" ? ASSET_LAYER_TYPES : UTILITY_TYPES);

type AssetLean = {
  _id: mongoose.Types.ObjectId; assetType: string; name: string; condition: string; agencyId?: mongoose.Types.ObjectId | null;
  location?: { district?: string; province?: string; roadName?: string } | null; sourceProjectId?: mongoose.Types.ObjectId | null;
  healthScore?: number | null; lastInspectionAt?: Date | null; nextMaintenanceAt?: Date | null; commissionedAt?: Date | null;
  sensitivity?: string | null; geometry?: unknown;
};

async function toRows(ctx: Ctx, actor: AuthenticatedActor, docs: AssetLean[]): Promise<Map<string, AssetRow>> {
  const agencyIds = [...new Set(docs.map((d) => d.agencyId?.toString()).filter((x): x is string => Boolean(x)))];
  const projectIds = [...new Set(docs.map((d) => d.sourceProjectId?.toString()).filter((x): x is string => Boolean(x)))];
  const scoped = ctx.has("project.read") ? await projectScopeFilter(actor) : null;
  const [agencies, codes, titles] = await Promise.all([
    Agency.find({ _id: { $in: agencyIds } }).select("name").lean(),
    // Only the project code is read here, to label demo records; it is never returned.
    Project.find({ _id: { $in: projectIds } }).select("projectCode").lean(),
    scoped ? Project.find({ $and: [scoped, { _id: { $in: projectIds } }] }).select("title").lean() : Promise.resolve([] as { _id: mongoose.Types.ObjectId; title: string }[]),
  ]);
  const names = new Map(agencies.map((a) => [a._id.toString(), a.name as string]));
  const demo = new Map(codes.map((p) => [p._id.toString(), DEMO_CODES.has(p.projectCode as string)]));
  const title = new Map(titles.map((p) => [p._id.toString(), p.title as string]));
  return new Map(docs.map((d) => [d._id.toString(), {
    id: d._id.toString(), assetType: d.assetType, name: d.name, condition: d.condition, agencyId: d.agencyId?.toString() ?? null,
    agencyName: d.agencyId ? names.get(d.agencyId.toString()) ?? null : null, district: d.location?.district ?? null, province: d.location?.province ?? null,
    roadName: d.location?.roadName ?? null, sensitivity: effectiveSensitivity(d), healthScore: d.healthScore ?? null,
    lastInspectionAt: d.lastInspectionAt ?? null, nextMaintenanceAt: d.nextMaintenanceAt ?? null, commissionedAt: d.commissionedAt ?? null,
    sourceProjectId: d.sourceProjectId?.toString() ?? null, sourceProjectTitle: d.sourceProjectId ? title.get(d.sourceProjectId.toString()) ?? null : null,
    isDemo: d.sourceProjectId ? demo.get(d.sourceProjectId.toString()) === true : false,
  }]));
}

const ASSET_SELECT = "assetType name condition agencyId location.district location.province location.roadName sourceProjectId lastInspectionAt nextMaintenanceAt commissionedAt sensitivity geometry";

/** Assets (Step 85) and utilities (Step 86): same reader, different type set. Restricted rows the viewer may not see are excluded by the query. */
export async function assetLayer(actor: AuthenticatedActor, bbox: Bbox, layer: AssetLayerId, q: LayerQ): Promise<LayerResult> {
  const ctx = await contextOf(actor);
  if (!ctx.has("asset.read")) return FORBIDDEN;
  const { viewer } = ctx;
  const query = { $and: [visibleAssetFilter(viewer), assetNarrow(layer, q.nf, ctx.ids, viewer.platform), within(bbox)] };
  const found = (await Asset.find(query).select(`${ASSET_SELECT}${viewer.canHealth ? " healthScore" : ""}`).sort({ _id: 1 }).limit(q.limit + 1).maxTimeMS(3000).lean()) as unknown as AssetLean[];
  const truncated = found.length > q.limit;
  const rows = await toRows(ctx, actor, found.slice(0, q.limit));
  const [hidden, total] = await Promise.all([
    // Restricted-hidden is a count of rows this viewer may not see; it ignores the filters so it can never be used to probe them.
    Asset.countDocuments({ $and: [hiddenRestrictedFilter(viewer), { assetType: { $in: [...layerTypes(layer)] } }, within(bbox)] }).maxTimeMS(1500),
    truncated ? Asset.countDocuments(query).maxTimeMS(1500).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const items = found.slice(0, q.limit).flatMap((d) => {
    const row = rows.get(d._id.toString())!;
    const tier = tierOf(viewer, row);
    return tier === "HIDDEN" ? [] : [{ geometry: d.geometry, properties: projectAssetProperties(row, layer, tier, viewer) }];
  });
  return { ok: true, layer: { ...layerCollection(items, truncated, { limit: q.limit, zoom: q.zoom, fields: q.fields, layer }), generatedAt: new Date().toISOString(), restrictedHidden: hidden, hasDemo: items.some((i) => i.properties.isDemo === true), ...(total !== undefined ? { total } : {}) } };
}

/** Hazard zones plus project-risk markers (Step 87). Zones need risk.read; markers additionally follow project read scope. */
export async function riskLayer(actor: AuthenticatedActor, bbox: Bbox, q: LayerQ): Promise<LayerResult> {
  const ctx = await contextOf(actor);
  if (!ctx.has("risk.read")) return FORBIDDEN;
  const nf = q.nf;
  const items: { geometry: unknown; properties: Record<string, unknown> }[] = [];
  let truncated = false;
  const zoneCap = Math.min(100, q.limit);
  const markerCap = Math.min(150, q.limit);
  if (nf.kind !== "project") {
    const zones = await HazardZone.find({ $and: [hazardVisible(ctx), hazardNarrow(nf), within(bbox)] }).sort({ _id: 1 }).limit(zoneCap + 1).maxTimeMS(3000).lean();
    truncated = zones.length > zoneCap;
    const agencies = await Agency.find({ _id: { $in: zones.map((z) => z.agencyId).filter(Boolean) } }).select("name").lean();
    const names = new Map(agencies.map((ag) => [ag._id.toString(), ag.name as string]));
    for (const z of zones.slice(0, zoneCap)) items.push({ geometry: z.geometry, properties: hazardProperties(z as unknown as ZoneLean, names.get(z.agencyId?.toString() ?? "") ?? null) });
  }
  // Hazard-only filters (type, level) narrow zones; they do not remove project markers unless a marker filter is also set.
  const markerFiltersOnly = nf.kind === "project" || (!nf.hazardType.length && !nf.hazardLevel.length);
  if (nf.kind !== "hazard" && markerFiltersOnly && ctx.has("project.read")) {
    const scoped = await projectScopeFilter(actor);
    if (scoped) {
      const where = projectNarrow({ ...nf, projectStatus: [], projectType: [], dateFrom: undefined as never, dateTo: undefined as never });
      const projects = await Project.find({ $and: [scoped, where, within(bbox)] }).select("projectCode title geometry").sort({ _id: 1 }).limit(markerCap + 1).maxTimeMS(3000).lean();
      truncated = truncated || projects.length > markerCap;
      const kept = projects.slice(0, markerCap);
      const latest = await RiskAssessment.aggregate<{ _id: mongoose.Types.ObjectId; overallRisk: number; createdAt: Date; modelVersion: string }>([
        { $match: { projectId: { $in: kept.map((p) => p._id) } } }, { $sort: { createdAt: -1 } },
        { $group: { _id: "$projectId", overallRisk: { $first: "$overallRisk" }, createdAt: { $first: "$createdAt" }, modelVersion: { $first: "$modelVersion" } } },
      ]).option({ maxTimeMS: 3000 });
      const byProject = new Map(latest.map((r) => [r._id.toString(), r]));
      for (const p of kept) {
        const assessment = byProject.get(p._id.toString());
        const point = representativePoint(p.geometry as { type: string; coordinates: unknown });
        if (!assessment || !point) continue;
        const band = riskBand(assessment.overallRisk);
        if (nf.riskBand.length && !nf.riskBand.includes(band)) continue;
        items.push({ geometry: { type: "Point", coordinates: point }, properties: {
          id: p._id.toString(), layer: "risks", kind: "project", projectId: p._id.toString(), projectCode: p.projectCode, title: p.title,
          overallRisk: assessment.overallRisk, riskBand: band, latestAssessedAt: iso(assessment.createdAt), modelVersion: assessment.modelVersion,
          provenance: DEMO_CODES.has(p.projectCode as string) ? "DEMO" : "LIVE", isDemo: DEMO_CODES.has(p.projectCode as string),
        } });
      }
    }
  }
  return { ok: true, layer: { ...layerCollection(items, truncated, { limit: q.limit, zoom: q.zoom, fields: q.fields, layer: "risks" }), generatedAt: new Date().toISOString(), hasDemo: items.some((i) => i.properties.isDemo === true) } };
}

type ZoneLean = { _id: mongoose.Types.ObjectId; name: string; description?: string | null; hazardType: string; level: string; geometry?: unknown; agencyId?: mongoose.Types.ObjectId | null; isDemo?: boolean;
  source: { kind: string; organisation: string; datasetName: string; licence?: string | null; url?: string | null; dataDate?: Date | null; retrievedAt: Date } };

function hazardProperties(z: ZoneLean, agencyName: string | null): Record<string, unknown> {
  return {
    id: z._id.toString(), layer: "risks", kind: "hazard", name: z.name, hazardType: z.hazardType, level: z.level, description: z.description ?? null,
    source: { kind: z.source.kind, organisation: z.source.organisation, datasetName: z.source.datasetName, licence: z.source.licence ?? null, url: z.source.url ?? null, dataDate: iso(z.source.dataDate), retrievedAt: iso(z.source.retrievedAt) },
    provenance: z.source.kind, isDemo: z.isDemo === true || z.source.kind === "DEMO", agencyName,
  };
}

export type Focal = { geometry: { type: string; coordinates: unknown } };
/** The focal feature's stored geometry, resolved server-side under the viewer's own scope. null means not found or not allowed (a 404, never a 403). */
export async function focalOf(ctx: Ctx, actor: AuthenticatedActor, layer: string, id: string): Promise<Focal | null> {
  const oid = new mongoose.Types.ObjectId(id);
  try {
    if (layer === "projects") {
      if (!ctx.has("project.read")) return null;
      const scoped = await projectScopeFilter(actor);
      const doc = scoped ? await Project.findOne({ $and: [scoped, { _id: oid }] }).select("geometry").lean() : null;
      return doc?.geometry ? { geometry: doc.geometry as Focal["geometry"] } : null;
    }
    if (layer === "roadworks") {
      if (!ctx.has("roadsync.work_request.read")) return null;
      const doc = await WorkRequest.findOne({ $and: [await workRequestFilter(actor), { _id: oid }] }).select("geometry").lean();
      return doc?.geometry ? { geometry: doc.geometry as Focal["geometry"] } : null;
    }
    if (layer === "conflicts") {
      if (!ctx.has("roadsync.conflict.read")) return null;
      const doc = (await ConflictRecord.findOne({ $and: [accessFilter(await whoIs(actor)), { _id: oid }] }).select("hotspot").lean()) as { hotspot?: Focal["geometry"] } | null;
      return doc?.hotspot ? { geometry: doc.hotspot } : null;
    }
    if (layer === "assets" || layer === "utilities") {
      if (!ctx.has("asset.read")) return null;
      const doc = await Asset.findOne({ $and: [visibleAssetFilter(ctx.viewer), { _id: oid }, { assetType: { $in: [...layerTypes(layer)] } }] }).select("geometry").lean();
      return doc?.geometry ? { geometry: doc.geometry as Focal["geometry"] } : null;
    }
    if (layer === "risks") {
      if (!ctx.has("risk.read")) return null;
      const doc = await HazardZone.findOne({ $and: [hazardVisible(ctx), { _id: oid }] }).select("geometry").lean();
      if (doc?.geometry) return { geometry: doc.geometry as Focal["geometry"] };
      const scoped = ctx.has("project.read") ? await projectScopeFilter(actor) : null;
      const project = scoped ? await Project.findOne({ $and: [scoped, { _id: oid }] }).select("geometry").lean() : null;
      const point = project ? representativePoint(project.geometry as Focal["geometry"]) : null;
      return point ? { geometry: { type: "Point", coordinates: point } } : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Nearby results list features; their geometry is not needed and is not sent. */
function dropGeometry<T extends { geometry?: unknown }>(item: T): Omit<T, "geometry"> {
  const { geometry, ...rest } = item;
  void geometry;
  return rest;
}

type Fail = { ok: false; status: 400 | 403 | 404 | 503; code: string };
const NOT_FOUND: Fail = { ok: false, status: 404, code: "NOT_FOUND" };

const assetItem = (d: AssetLean, row: AssetRow, layer: AssetLayerId, ctx: Ctx) => {
  const tier = tierOf(ctx.viewer, row);
  return tier === "HIDDEN" ? null : { id: row.id, layer, name: row.name, assetType: row.assetType, agencyName: row.agencyName, tier, isDemo: row.isDemo, point: representativePoint(d.geometry as Focal["geometry"]), geometry: transportGeometry(d.geometry) };
};

async function assetsIn(ctx: Ctx, actor: AuthenticatedActor, geometry: Focal["geometry"], layer: AssetLayerId, cap: number, excludeId?: string) {
  const match: Record<string, unknown> = { $and: [visibleAssetFilter(ctx.viewer), { assetType: { $in: [...layerTypes(layer)] } }, { geometry: { $geoIntersects: { $geometry: geometry } } }, ...(excludeId ? [{ _id: { $ne: new mongoose.Types.ObjectId(excludeId) } }] : [])] };
  const [total, docs, hidden] = await Promise.all([
    Asset.countDocuments(match),
    Asset.find(match).select(ASSET_SELECT).sort({ _id: 1 }).limit(cap).lean() as unknown as Promise<AssetLean[]>,
    Asset.countDocuments({ $and: [hiddenRestrictedFilter(ctx.viewer), { assetType: { $in: [...layerTypes(layer)] } }, { geometry: { $geoIntersects: { $geometry: geometry } } }] }),
  ]);
  const rows = await toRows(ctx, actor, docs);
  return { total, hidden, items: docs.flatMap((d) => { const item = assetItem(d, rows.get(d._id.toString())!, layer, ctx); return item ? [item] : []; }) };
}

const zoneItem = (z: ZoneLean) => ({ id: z._id.toString(), layer: "risks", name: z.name, hazardType: z.hazardType, level: z.level, source: { kind: z.source.kind, organisation: z.source.organisation, datasetName: z.source.datasetName, dataDate: iso(z.source.dataDate) }, isDemo: z.isDemo === true || z.source.kind === "DEMO", point: representativePoint(z.geometry as Focal["geometry"]), geometry: transportGeometry(z.geometry) });

/**
 * Exposure Check. For a zone: in-scope projects, roadworks and assets/utilities that intersect it. For any other
 * feature: the hazard zones it intersects. Spatial overlap with recorded hazard data only; not a prediction.
 */
export async function exposure(actor: AuthenticatedActor, layer: string, id: string) {
  const ctx = await contextOf(actor);
  if (!ctx.has("risk.read")) return FORBIDDEN;
  const focal = await focalOf(ctx, actor, layer, id);
  if (!focal) return NOT_FOUND;
  const generatedAt = new Date().toISOString();
  const isZone = layer === "risks" && Boolean(await HazardZone.exists({ _id: id }));
  if (!isZone) {
    const zones = (await HazardZone.find({ $and: [hazardVisible(ctx), { geometry: { $geoIntersects: { $geometry: focal.geometry } } }] }).sort({ _id: 1 }).limit(25).lean()) as unknown as ZoneLean[];
    const worst = zones.reduce((w, z) => Math.max(w, LEVELS.indexOf(z.level as never)), -1);
    return { ok: true as const, data: { mode: "zones", generatedAt, zones: zones.map(zoneItem), worstLevel: worst >= 0 ? LEVELS[worst] : null } };
  }
  const projects = ctx.has("project.read") ? await projectScopeFilter(actor) : null;
  const projectQuery = projects ? { $and: [projects, { geometry: { $geoIntersects: { $geometry: focal.geometry } } }] } : null;
  const roadworksFilter = ctx.has("roadsync.work_request.read") ? await workRequestFilter(actor) : null;
  const roadworkQuery = roadworksFilter ? { $and: [roadworksFilter, { geometry: { $geoIntersects: { $geometry: focal.geometry } } }] } : null;
  const [pc, pDocs, rc, rDocs, assets, utilities] = await Promise.all([
    projectQuery ? Project.countDocuments(projectQuery) : 0,
    projectQuery ? Project.find(projectQuery).select("projectCode title status geometry").sort({ _id: 1 }).limit(25).lean() : [],
    roadworkQuery ? WorkRequest.countDocuments(roadworkQuery) : 0,
    roadworkQuery ? WorkRequest.find(roadworkQuery).select("workType status geometry").sort({ _id: 1 }).limit(25).lean() : [],
    ctx.has("asset.read") ? assetsIn(ctx, actor, focal.geometry, "assets", 25) : null,
    ctx.has("asset.read") ? assetsIn(ctx, actor, focal.geometry, "utilities", 25) : null,
  ]);
  return { ok: true as const, data: { mode: "records", generatedAt, records: {
    projects: projectQuery ? { total: pc, items: pDocs.map((p) => ({ id: p._id.toString(), layer: "projects", title: p.title, projectCode: p.projectCode, status: p.status, point: representativePoint(p.geometry as Focal["geometry"]), geometry: transportGeometry(p.geometry) })) } : null,
    roadworks: roadworkQuery ? { total: rc, items: rDocs.map((w) => ({ id: w._id.toString(), layer: "roadworks", workType: w.workType, status: w.status, point: representativePoint(w.geometry as Focal["geometry"]), geometry: transportGeometry(w.geometry) })) } : null,
    assets, utilities,
  } } };
}

/** Nearby Context Lens. Envelope-based (the focal geometry's bbox grown by the radius), so it is approximate and reports no distances. */
export async function nearby(actor: AuthenticatedActor, featureLayer: string, featureId: string, radiusM: number, layers: readonly string[]) {
  const ctx = await contextOf(actor);
  const focal = await focalOf(ctx, actor, featureLayer, featureId);
  if (!focal) return NOT_FOUND;
  const bounds = geometryBounds(focal.geometry);
  if (!bounds) return NOT_FOUND;
  const box = envelopeAround(bounds, radiusM);
  const envelope = viewportPolygon(box);
  const out: Record<string, unknown> = {};
  let restrictedHidden = 0;
  const same = (layer: string) => (featureLayer === layer ? featureId : undefined);
  for (const layer of layers) {
    if (layer === "assets" || layer === "utilities") {
      if (!ctx.has("asset.read")) { out[layer] = null; continue; }
      const found = await assetsIn(ctx, actor, envelope, layer, 30, same(layer));
      restrictedHidden += found.hidden;
      out[layer] = { total: found.total, items: found.items.map(dropGeometry) };
    } else if (layer === "risks") {
      if (!ctx.has("risk.read")) { out[layer] = null; continue; }
      const q = { $and: [hazardVisible(ctx), { geometry: { $geoIntersects: { $geometry: envelope } } }, ...(same("risks") ? [{ _id: { $ne: new mongoose.Types.ObjectId(featureId) } }] : [])] };
      const [total, zones] = await Promise.all([HazardZone.countDocuments(q), HazardZone.find(q).sort({ _id: 1 }).limit(30).lean() as unknown as Promise<ZoneLean[]>]);
      out[layer] = { total, items: zones.map((z) => dropGeometry(zoneItem(z))) };
    }
  }
  return { ok: true as const, data: { generatedAt: new Date().toISOString(), radiusM, envelope: { type: "Polygon", coordinates: envelope.coordinates }, approximate: true, layers: out, restrictedHidden } };
}

/** Quick-view detail for assets, utilities and risk features. Out-of-scope ids answer 404 so existence is not leaked. */
export async function featureDetail(actor: AuthenticatedActor, layer: "assets" | "utilities" | "risks", id: string) {
  const ctx = await contextOf(actor);
  const oid = new mongoose.Types.ObjectId(id);
  if (layer === "risks") {
    if (!ctx.has("risk.read")) return NOT_FOUND;
    const zone = (await HazardZone.findOne({ $and: [hazardVisible(ctx), { _id: oid }] }).lean()) as unknown as ZoneLean | null;
    if (zone) {
      const name = zone.agencyId ? (await Agency.findById(zone.agencyId).select("name").lean())?.name ?? null : null;
      return { ok: true as const, data: { kind: "hazard", properties: hazardProperties(zone, name as string | null) } };
    }
    const scoped = ctx.has("project.read") ? await projectScopeFilter(actor) : null;
    const project = scoped ? await Project.findOne({ $and: [scoped, { _id: oid }] }).select("projectCode title").lean() : null;
    if (!project) return NOT_FOUND;
    const latest = await RiskAssessment.findOne({ projectId: oid }).sort({ createdAt: -1 }).select("overallRisk createdAt modelVersion factors.category factors.score").lean();
    if (!latest) return NOT_FOUND;
    // Category and score only; the free-text factor descriptions and recommendations never leave.
    const top = [...(latest.factors ?? [])].sort((a, b) => b.score - a.score).slice(0, 3).map((f) => ({ category: f.category, score: f.score }));
    return { ok: true as const, data: { kind: "project", properties: { id, layer: "risks", kind: "project", projectId: id, projectCode: project.projectCode, title: project.title, overallRisk: latest.overallRisk, riskBand: riskBand(latest.overallRisk), latestAssessedAt: iso(latest.createdAt), modelVersion: latest.modelVersion, topFactors: top } } };
  }
  if (!ctx.has("asset.read")) return NOT_FOUND;
  const doc = (await Asset.findOne({ $and: [visibleAssetFilter(ctx.viewer), { _id: oid }, { assetType: { $in: [...layerTypes(layer)] } }] }).select(`${ASSET_SELECT}${ctx.viewer.canHealth ? " healthScore" : ""}`).lean()) as unknown as AssetLean | null;
  if (!doc) return NOT_FOUND;
  const row = (await toRows(ctx, actor, [doc])).get(id)!;
  const tier = tierOf(ctx.viewer, row);
  if (tier === "HIDDEN") return NOT_FOUND;
  const properties = projectAssetProperties(row, layer, tier, ctx.viewer);
  const maintenance = tier === "FULL"
    ? (await MaintenanceRecord.find({ assetId: oid }).sort({ scheduledDate: -1 }).limit(5).select("maintenanceType status scheduledDate completedDate").lean()).map((m) => ({ maintenanceType: m.maintenanceType, status: m.status, scheduledDate: iso(m.scheduledDate), completedDate: iso(m.completedDate) }))
    : [];
  return { ok: true as const, data: { kind: layer, properties, maintenance, reasons: tier === "FULL" ? attentionReasons(row) : [] } };
}
