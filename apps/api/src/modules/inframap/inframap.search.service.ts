import mongoose from "mongoose";

import { DEMO_PROJECT_CODES } from "../../database/seeds/demo/catalog.js";
import { Agency } from "../agencies/models/agency.model.js";
import { Asset } from "../assets/models/asset.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Project } from "../projects/models/project.model.js";
import { projectScopeFilter, projectsWithoutLocation } from "../projects/projects.service.js";
import { HazardZone } from "../risk/models/hazard-zone.model.js";
import { accessFilter } from "../roadsync/conflict-record.read.js";
import { whoIs } from "../roadsync/conflict-record.service.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";
import { WorkRequest } from "../roadsync/models/work-request.model.js";
import { readFilter as workRequestFilter } from "../roadsync/work-requests.service.js";
import { WORK_TYPES } from "../roadsync/roadsync.constants.js";
import { hazardVisible, contextOf, layerTypes, type Ctx } from "./inframap.context.service.js";
import { hiddenRestrictedFilter, representativePoint, UTILITY_CLASS, visibleAssetFilter } from "./inframap.access.js";
import { assetNarrow, conflictNarrow, escapeRegex, hazardNarrow, LAYER_IDS, projectNarrow, roadworkNarrow, type LayerId, type NF } from "./inframap.filters.js";
import { DISTRICTS, PROVINCES, searchPlaces } from "./gazetteer.js";
import { geometryBounds, viewportPolygon, type Bbox } from "./inframap.geo.js";
import { projectIdsInLocation } from "./inframap.service.js";

/**
 * Permission-safe search, facets and data health. Every query starts from the same scope filter the layer endpoints
 * use (project read scope, work-request scope, conflict access filter, visibleAssetFilter, hazard visibility), so a
 * record the viewer cannot see is never matched, counted or hinted at. Restricted utilities the viewer may not see are
 * excluded in the query. Regexes are always escaped; every query has maxTimeMS and a result cap.
 * Conflict side titles are deliberately NOT searched: they are redacted per agency in RoadSync and a text match would leak them.
 */
const MAX_MS = 1500;
const DEMO_CODES = new Set<string>(DEMO_PROJECT_CODES);
const iso = (d: unknown) => (d ? new Date(d as string | number | Date).toISOString() : null);

export type Hint = { kind: "point"; coordinates: [number, number] } | { kind: "bbox"; bbox: Bbox };
export type SearchItem = { id: string; layer: string; title: string; subtitle: string | null; status: string | null; badge: string | null; geometryHint: Hint | null; noLocation?: true; matchedField: string; rank: number };
export type SearchGroup = { layer: string; items: SearchItem[]; hasMore: boolean };

function hintOf(geometry: unknown): Hint | null {
  const b = geometryBounds(geometry as { coordinates?: unknown });
  if (!b) return null;
  if (b[0] === b[2] && b[1] === b[3]) return { kind: "point", coordinates: [b[0], b[1]] };
  if (geometry && typeof geometry === "object" && (geometry as { type?: string }).type === "LineString") {
    const p = representativePoint(geometry as { type: string; coordinates: unknown });
    if (p && (b[2] - b[0] < 0.0005 && b[3] - b[1] < 0.0005)) return { kind: "point", coordinates: p };
  }
  return { kind: "bbox", bbox: b };
}

type Matcher = { q: string; prefix: RegExp; word: RegExp; contains: RegExp };
export function matcherOf(raw: string): Matcher {
  const q = raw.trim().replace(/\s+/g, " ");
  const e = escapeRegex(q);
  return { q: q.toLowerCase(), prefix: new RegExp(`^${e}`, "i"), word: new RegExp(`(^|[\\s\\-/])${e}`, "i"), contains: new RegExp(e, "i") };
}
/** exact 1 > prefix 2 > word prefix 3 > contains 4; 0 = no match. */
export function rankOf(m: Matcher, text: string | null | undefined): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  return t === m.q ? 1 : m.prefix.test(text) ? 2 : m.word.test(text) ? 3 : m.contains.test(text) ? 4 : 0;
}
const best = (m: Matcher, fields: [string, string | null | undefined][]): { rank: number; field: string } =>
  fields.reduce((acc, [name, text]) => { const r = rankOf(m, text); return r && (!acc.rank || r < acc.rank) ? { rank: r, field: name } : acc; }, { rank: 0, field: "" });

const bboxCond = (bbox: Bbox | undefined, field = "geometry") => (bbox ? [{ [field]: { $geoIntersects: { $geometry: viewportPolygon(bbox) } } }] : []);
const sortItems = (items: SearchItem[]) => items.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));

export type SearchParams = { q: string; layers: readonly string[]; scope: "view" | "all"; bbox?: Bbox; limit: number; nf: NF };

/** Anchored prefix pass first (index-friendly), then a bounded contains pass only if room remains. */
async function twoPass<T extends { _id: mongoose.Types.ObjectId }>(run: (rx: RegExp, exclude: mongoose.Types.ObjectId[], limit: number) => Promise<T[]>, m: Matcher, limit: number): Promise<T[]> {
  const first = await run(m.prefix, [], limit + 1);
  if (first.length > limit) return first;
  const rest = await run(m.contains, first.map((d) => d._id), limit + 1 - first.length);
  return [...first, ...rest];
}

export async function search(actor: AuthenticatedActor, p: SearchParams) {
  const started = Date.now();
  const ctx = await contextOf(actor);
  const m = matcherOf(p.q);
  const lim = p.limit;
  const wanted = new Set(p.layers);
  const groups: SearchGroup[] = [];
  let truncated = false;
  const bbox = p.scope === "view" ? p.bbox : undefined;
  const finish = (layer: string, items: SearchItem[]) => { if (items.length) { sortItems(items); groups.push({ layer, items: items.slice(0, lim), hasMore: items.length > lim }); } };
  const guard = async (layer: string, fn: () => Promise<SearchItem[]>) => { try { finish(layer, await fn()); } catch { truncated = true; } };

  if (wanted.has("projects") && ctx.has("project.read")) await guard("projects", async () => {
    const scoped = await projectScopeFilter(actor);
    if (!scoped) return [];
    const base = [scoped, projectNarrow(p.nf), ...bboxCond(bbox)];
    const docs = /^INF-[A-Z_]+-\d+$/i.test(p.q)
      ? await Project.find({ $and: [...base, { projectCode: new RegExp(`^${escapeRegex(p.q)}$`, "i") }] }).select("title projectCode status location.district geometry").limit(1).maxTimeMS(MAX_MS).lean()
      : await twoPass((rx, exclude, limit) => Project.find({ $and: [...base, ...(exclude.length ? [{ _id: { $nin: exclude } }] : []), { $or: rx === m.prefix ? [{ projectCode: rx }, { title: rx }] : [{ projectCode: rx }, { title: rx }, { "location.locality": rx }, { "location.roadName": rx }, { "location.district": rx }] }] }).select("title projectCode status location.district location.locality location.roadName geometry").limit(limit).maxTimeMS(MAX_MS).lean(), m, lim);
    return docs.map((d) => {
      const hit = best(m, [["projectCode", d.projectCode], ["title", d.title], ["locality", d.location?.locality], ["roadName", d.location?.roadName], ["district", d.location?.district]]);
      const hint = hintOf(d.geometry);
      return { id: d._id.toString(), layer: "projects", title: d.title, subtitle: [d.projectCode, d.location?.district].filter(Boolean).join(" · "), status: d.status, badge: DEMO_CODES.has(d.projectCode) ? "DEMO" : null, geometryHint: hint, ...(hint ? {} : { noLocation: true as const }), matchedField: hit.field || "title", rank: hit.rank || 4 };
    });
  });

  if (wanted.has("roadworks") && ctx.has("roadsync.work_request.read")) await guard("roadworks", async () => {
    const scope = await workRequestFilter(actor);
    const scopedProjects = ctx.has("project.read") ? await projectScopeFilter(actor) : null;
    const matchingProjects = scopedProjects ? (await twoPass((rx, exclude, limit) => Project.find({ $and: [scopedProjects, ...(exclude.length ? [{ _id: { $nin: exclude } }] : []), { $or: [{ projectCode: rx }, { title: rx }] }] }).select("_id").limit(limit).maxTimeMS(MAX_MS).lean(), m, 60)).map((d) => d._id) : [];
    const typeNeedle = p.q.toUpperCase().replace(/[\s-]+/g, "_");
    const types = WORK_TYPES.filter((t) => t.includes(typeNeedle));
    if (!matchingProjects.length && !types.length) return [];
    const locIds = await projectIdsInLocation(p.nf);
    const docs = await WorkRequest.find({ $and: [scope, roadworkNarrow(p.nf, locIds), ...bboxCond(bbox), { $or: [{ projectId: { $in: matchingProjects } }, { workType: { $in: [...types] } }] }] }).select("workType status projectId geometry").sort({ plannedStart: 1, _id: 1 }).limit(lim + 1).maxTimeMS(MAX_MS).lean();
    const projects = await Project.find({ _id: { $in: docs.map((d) => d.projectId) } }).select("title projectCode").lean();
    const byId = new Map(projects.map((pr) => [pr._id.toString(), pr]));
    return docs.map((d) => {
      const pr = byId.get(d.projectId.toString());
      const typeHit = types.includes(d.workType as never);
      const hit = best(m, [["project", pr?.title], ["projectCode", pr?.projectCode]]);
      const hint = hintOf(d.geometry);
      return { id: d._id.toString(), layer: "roadworks", title: pr?.title ?? d.workType, subtitle: [d.workType.replace(/_/g, " ").toLowerCase(), pr?.projectCode].filter(Boolean).join(" · "), status: d.status, badge: pr && DEMO_CODES.has(pr.projectCode) ? "DEMO" : null, geometryHint: hint, ...(hint ? {} : { noLocation: true as const }), matchedField: typeHit && !hit.rank ? "workType" : hit.field || "project", rank: hit.rank || 3 };
    });
  });

  if (wanted.has("conflicts") && ctx.has("roadsync.conflict.read")) await guard("conflicts", async () => {
    const access = accessFilter(await whoIs(actor));
    const base = [access, conflictNarrow(p.nf), ...bboxCond(bbox, "hotspot")];
    const docs = await twoPass((rx, exclude, limit) => ConflictRecord.find({ $and: [...base, ...(exclude.length ? [{ _id: { $nin: exclude } }] : []), { $or: rx === m.prefix ? [{ conflictNo: rx }] : [{ conflictNo: rx }, { district: rx }] }] }).select("conflictNo status district severity.current hotspot").sort({ "severity.current.score": -1 }).limit(limit).maxTimeMS(MAX_MS).lean(), m, lim) as unknown as { _id: mongoose.Types.ObjectId; conflictNo: string; status: string; district?: string | null; severity?: { current?: { band?: string } }; hotspot: unknown }[];
    return docs.map((d) => {
      const hit = best(m, [["conflictNo", d.conflictNo], ["district", d.district]]);
      return { id: d._id.toString(), layer: "conflicts", title: d.conflictNo, subtitle: d.district ?? null, status: d.status, badge: d.severity?.current?.band ?? null, geometryHint: hintOf(d.hotspot), matchedField: hit.field || "conflictNo", rank: hit.rank || 4 };
    });
  });

  for (const layer of ["assets", "utilities"] as const) {
    if (!wanted.has(layer) || !ctx.has("asset.read")) continue;
    await guard(layer, async () => {
      const own = { agencyId: { $in: ctx.ids } };
      const base = [visibleAssetFilter(ctx.viewer), assetNarrow(layer, p.nf, ctx.ids, ctx.viewer.platform), ...bboxCond(bbox)];
      // Place-like text (locality, road) is only searchable on the viewer's own records: other agencies' location text is stripped at awareness tier.
      const textOr = (rx: RegExp, wide: boolean) => ({ $or: [{ name: rx }, { "location.district": rx }, ...(wide ? [{ $and: [ctx.viewer.platform ? {} : own, { $or: [{ "location.locality": rx }, { "location.roadName": rx }] }] }] : [])] });
      const docs = await twoPass((rx, exclude, limit) => Asset.find({ $and: [...base, ...(exclude.length ? [{ _id: { $nin: exclude } }] : []), textOr(rx, rx !== m.prefix)] }).select("name assetType condition geometry sourceProjectId").limit(limit).maxTimeMS(MAX_MS).lean(), m, lim);
      const projectCodes = await Project.find({ _id: { $in: docs.map((d) => d.sourceProjectId) } }).select("projectCode").lean();
      const demo = new Set(projectCodes.filter((pr) => DEMO_CODES.has(pr.projectCode)).map((pr) => pr._id.toString()));
      return docs.map((d) => ({ id: d._id.toString(), layer, title: d.name, subtitle: layer === "utilities" ? UTILITY_CLASS[d.assetType] ?? d.assetType : d.assetType, status: d.condition, badge: demo.has(d.sourceProjectId.toString()) ? "DEMO" : null, geometryHint: hintOf(d.geometry), matchedField: "name", rank: rankOf(m, d.name) || 4 }));
    });
  }

  if (wanted.has("risks") && ctx.has("risk.read")) await guard("risks", async () => {
    const typeNeedle = p.q.toUpperCase().replace(/[\s-]+/g, "_");
    const docs = await HazardZone.find({ $and: [hazardVisible(ctx), hazardNarrow(p.nf), ...bboxCond(bbox), { $or: [{ name: m.contains }, { hazardType: { $regex: `^${escapeRegex(typeNeedle)}` } }] }] }).select("name hazardType level geometry isDemo").limit(lim + 1).maxTimeMS(MAX_MS).lean();
    return docs.map((d) => ({ id: d._id.toString(), layer: "risks", title: d.name, subtitle: d.hazardType, status: d.level, badge: d.isDemo ? "DEMO" : null, geometryHint: hintOf(d.geometry), matchedField: rankOf(m, d.name) ? "name" : "hazardType", rank: rankOf(m, d.name) || 3 }));
  });

  // Agencies the viewer can see features of: their own (all, for platform) plus owners of the assets they may see.
  if (wanted.has("agencies")) await guard("agencies", async () => {
    const ids = await visibleAgencyIds(ctx, actor);
    if (ids === "all" ? false : ids.length === 0) return [];
    const docs = await Agency.find({ $and: [ids === "all" ? { status: "ACTIVE" } : { _id: { $in: ids } }, { $or: [{ name: m.contains }, { code: m.contains }] }] }).select("name code").limit(lim + 1).maxTimeMS(MAX_MS).lean();
    return docs.map((d) => { const hit = best(m, [["name", d.name], ["code", d.code]]); return { id: d._id.toString(), layer: "agencies", title: d.name, subtitle: d.code ?? null, status: null, badge: null, geometryHint: null, matchedField: hit.field || "name", rank: hit.rank || 4 }; });
  });

  if (wanted.has("places")) {
    const items = searchPlaces(p.q, lim + 1).map((pl) => ({ id: pl.name, layer: "places", title: pl.name, subtitle: pl.kind === "district" ? pl.province : "Province", status: null, badge: pl.kind, geometryHint: { kind: "bbox" as const, bbox: pl.bbox }, matchedField: "name", rank: pl.rank }));
    finish("places", items);
  }
  return { groups, took: Date.now() - started, truncated };
}

/** Agencies whose features the viewer can see: platform sees all; others see their own plus owners of visible (awareness-tier) assets. */
export async function visibleAgencyIds(ctx: Ctx, actor: AuthenticatedActor): Promise<mongoose.Types.ObjectId[] | "all"> {
  void actor;
  if (ctx.viewer.platform) return "all";
  const owners = ctx.has("asset.read") ? await Asset.distinct("agencyId", visibleAssetFilter(ctx.viewer)).maxTimeMS(MAX_MS) : [];
  return [...new Map([...ctx.ids, ...owners].filter(Boolean).map((id) => [String(id), id as mongoose.Types.ObjectId])).values()].slice(0, 300);
}

// ----------------------------------------------------------------------------------------------------------------
// Facets

type Count = { value: string; count: number };
const grp = async (run: () => Promise<{ _id: unknown; n: number }[]>): Promise<Count[]> => (await run().catch(() => [])).filter((r) => r._id !== null && r._id !== undefined && r._id !== "").map((r) => ({ value: String(r._id), count: r.n }));
const agg = (model: mongoose.Model<never>, match: Record<string, unknown>, key: unknown) =>
  () => (model as unknown as mongoose.Model<unknown>).aggregate<{ _id: unknown; n: number }>([{ $match: match }, { $group: { _id: key, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 80 }]).option({ maxTimeMS: MAX_MS });
const merge = (lists: Count[][]): Count[] => { const m = new Map<string, number>(); for (const l of lists) for (const c of l) m.set(c.value, (m.get(c.value) ?? 0) + c.count); return [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count); };
const CLOSED = ["resolved", "dismissed", "auto_closed", "withdrawn"];

/**
 * Facet counts under the current filters, excluding each facet's own filter (so choosing "Active" still shows how many
 * are "Approved"). Same scope filters as the layers; forbidden layers are simply absent.
 */
export async function facets(actor: AuthenticatedActor, nf: NF, bbox?: Bbox) {
  const ctx = await contextOf(actor);
  const out: Record<string, unknown> = { generatedAt: new Date().toISOString() };
  const own = ctx.ids;
  const geo = bbox ? [{ geometry: { $geoIntersects: { $geometry: viewportPolygon(bbox) } } }] : [];
  const geoHot = bbox ? [{ hotspot: { $geoWithin: { $geometry: viewportPolygon(bbox) } } }] : [];
  const globals: { agencies: Count[][]; provinces: Count[][]; districts: Count[][] } = { agencies: [], provinces: [], districts: [] };

  if (ctx.has("project.read")) {
    const scoped = await projectScopeFilter(actor);
    if (scoped) {
      const m = (omit?: keyof NF) => ({ $and: [scoped, projectNarrow(nf, omit), ...geo] });
      out.projects = { projectStatus: await grp(agg(Project as never, m("projectStatus"), "$status")), projectType: await grp(agg(Project as never, m("projectType"), "$projectType")) };
      globals.agencies.push(await grp(agg(Project as never, m("agencyId"), "$agencyId")));
      globals.provinces.push(await grp(agg(Project as never, m("province"), "$location.province")));
      globals.districts.push(await grp(agg(Project as never, m("district"), "$location.district")));
    }
  }
  if (ctx.has("roadsync.work_request.read")) {
    const scope = await workRequestFilter(actor);
    const loc = await projectIdsInLocation(nf);
    const m = (omit?: keyof NF) => ({ $and: [scope, roadworkNarrow(nf, omit === "province" || omit === "district" ? null : loc, omit), ...geo] });
    out.roadworks = { roadworkStatus: await grp(agg(WorkRequest as never, m("roadworkStatus"), "$status")), workType: await grp(agg(WorkRequest as never, m("workType"), "$workType")) };
    globals.agencies.push(await grp(agg(WorkRequest as never, m("agencyId"), "$agencyId")));
  }
  if (ctx.has("roadsync.conflict.read")) {
    try {
      const access = accessFilter(await whoIs(actor));
      const m = (omit?: keyof NF) => ({ $and: [access, conflictNarrow(nf, omit), ...geoHot] });
      out.conflicts = {
        conflictBand: await grp(agg(ConflictRecord as never, m("conflictBand"), "$severity.current.band")),
        conflictStatusGroup: await grp(agg(ConflictRecord as never, m("conflictStatusGroup"), { $cond: [{ $in: ["$status", CLOSED] }, "resolved", "open"] })),
      };
      globals.districts.push(await grp(agg(ConflictRecord as never, m("district"), "$district")));
    } catch { /* conflicts facets unavailable; the rest still answer */ }
  }
  if (ctx.has("asset.read")) {
    const vis = visibleAssetFilter(ctx.viewer);
    const m = (layer: "assets" | "utilities", omit?: keyof NF) => ({ $and: [vis, assetNarrow(layer, nf, own, ctx.viewer.platform, omit), ...geo] });
    out.assets = { assetType: await grp(agg(Asset as never, m("assets", "assetType"), "$assetType")), condition: await grp(agg(Asset as never, m("assets", "condition"), "$condition")) };
    const cls = await grp(agg(Asset as never, m("utilities", "utilityClass"), "$assetType"));
    out.utilities = { utilityClass: cls.map((c) => ({ value: UTILITY_CLASS[c.value] ?? c.value, count: c.count })) };
    globals.agencies.push(await grp(agg(Asset as never, m("assets", "agencyId"), "$agencyId")));
    globals.provinces.push(await grp(agg(Asset as never, m("assets", "province"), "$location.province")));
    globals.districts.push(await grp(agg(Asset as never, m("assets", "district"), "$location.district")));
  }
  if (ctx.has("risk.read")) {
    const m = (omit?: keyof NF) => ({ $and: [hazardVisible(ctx), hazardNarrow(nf, omit), ...geo] });
    out.risks = { hazardType: await grp(agg(HazardZone as never, m("hazardType"), "$hazardType")), hazardLevel: await grp(agg(HazardZone as never, m("hazardLevel"), "$level")) };
  }

  const agencyCounts = merge(globals.agencies);
  const ids = agencyCounts.map((c) => c.value).filter((v) => /^[a-f0-9]{24}$/i.test(v));
  const names = new Map((await Agency.find({ _id: { $in: ids } }).select("name").lean().maxTimeMS(MAX_MS)).map((a) => [a._id.toString(), a.name as string]));
  const canon = (list: Count[], valid: Set<string>) => merge([list.filter((c) => valid.has(c.value.toLowerCase())).map((c) => ({ ...c, value: c.value }))]);
  const provinceSet = new Set(PROVINCES.map((p) => p.name.toLowerCase()));
  const districtSet = new Set(DISTRICTS.map((d) => d.name.toLowerCase()));
  const canonical = (list: Count[], source: readonly { name: string }[]) => list.map((c) => ({ ...c, value: source.find((s) => s.name.toLowerCase() === c.value.toLowerCase())?.name ?? c.value }));
  out.global = {
    agencies: agencyCounts.filter((c) => names.has(c.value)).map((c) => ({ ...c, label: names.get(c.value)! })),
    provinces: canon(canonical(merge(globals.provinces), PROVINCES), provinceSet),
    districts: canon(canonical(merge(globals.districts), DISTRICTS), districtSet),
  };
  return out;
}

// ----------------------------------------------------------------------------------------------------------------
// Data health

export type HealthLayer = { layer: LayerId; total: number; withGeometry: number; withoutGeometry: number; completenessPct: number | null; latestUpdatedAt: string | null; demoCount: number; restrictedHidden?: number; neverInspected?: number; overdueMaintenance?: number };

/** Per-layer completeness and freshness, scoped exactly like the layers. Restricted records the viewer cannot see are a count only. */
export async function health(actor: AuthenticatedActor) {
  const ctx = await contextOf(actor);
  const layers: HealthLayer[] = [];
  const demoProjects = (await Project.find({ projectCode: { $in: [...DEMO_CODES] } }).select("_id").lean().maxTimeMS(MAX_MS)).map((p) => p._id);
  const mk = async (layer: LayerId, scope: Record<string, unknown>, model: mongoose.Model<never>, geoField: string, demoFilter: Record<string, unknown> | null, extra: Partial<HealthLayer> = {}) => {
    const m = model as unknown as mongoose.Model<unknown>;
    const [total, withGeometry, latest, demoCount] = await Promise.all([
      m.countDocuments(scope).maxTimeMS(MAX_MS),
      m.countDocuments({ $and: [scope, { [geoField]: { $exists: true, $ne: null } }] }).maxTimeMS(MAX_MS),
      m.findOne(scope).sort({ updatedAt: -1 }).select("updatedAt").lean().maxTimeMS(MAX_MS) as Promise<{ updatedAt?: Date } | null>,
      demoFilter ? m.countDocuments({ $and: [scope, demoFilter] }).maxTimeMS(MAX_MS) : Promise.resolve(0),
    ]);
    layers.push({ layer, total, withGeometry, withoutGeometry: total - withGeometry, completenessPct: total ? Math.round((withGeometry / total) * 100) : null, latestUpdatedAt: iso(latest?.updatedAt), demoCount, ...extra });
  };
  let unmapped: { total: number; items: { id: string; projectCode: string; title: string }[] } = { total: 0, items: [] };
  if (ctx.has("project.read")) {
    const scoped = await projectScopeFilter(actor);
    if (scoped) {
      await mk("projects", scoped, Project as never, "geometry", { _id: { $in: demoProjects } });
      const r = await projectsWithoutLocation(actor);
      if (r.ok) unmapped = { total: r.total, items: r.items };
    }
  }
  if (ctx.has("roadsync.work_request.read")) await mk("roadworks", await workRequestFilter(actor), WorkRequest as never, "geometry", { projectId: { $in: demoProjects } });
  if (ctx.has("roadsync.conflict.read")) { try { await mk("conflicts", { $and: [accessFilter(await whoIs(actor)), { recordType: "conflict" }] }, ConflictRecord as never, "hotspot", null); } catch { /* absent */ } }
  if (ctx.has("asset.read")) {
    const vis = visibleAssetFilter(ctx.viewer);
    for (const layer of ["assets", "utilities"] as const) {
      const scope = { $and: [vis, { assetType: { $in: [...layerTypes(layer)] } }] };
      const hidden = await Asset.countDocuments({ $and: [hiddenRestrictedFilter(ctx.viewer), { assetType: { $in: [...layerTypes(layer)] } }] }).maxTimeMS(MAX_MS);
      const ownOnly = ctx.viewer.platform ? {} : { agencyId: { $in: ctx.ids } };
      // Inspection and maintenance facts are FULL-tier only, so they are counted over the viewer's own records.
      const extra: Partial<HealthLayer> = layer === "assets"
        ? { restrictedHidden: hidden, neverInspected: await Asset.countDocuments({ $and: [scope, ownOnly, { lastInspectionAt: null }] }).maxTimeMS(MAX_MS), overdueMaintenance: await Asset.countDocuments({ $and: [scope, ownOnly, { nextMaintenanceAt: { $lt: new Date() } }] }).maxTimeMS(MAX_MS) }
        : { restrictedHidden: hidden };
      await mk(layer, scope, Asset as never, "geometry", { sourceProjectId: { $in: demoProjects } }, extra);
    }
  }
  if (ctx.has("risk.read")) await mk("risks", hazardVisible(ctx), HazardZone as never, "geometry", { isDemo: true });
  return { generatedAt: new Date().toISOString(), layers: LAYER_IDS.flatMap((l) => layers.filter((x) => x.layer === l)), unmappedProjects: unmapped };
}
