import mongoose from "mongoose";

import { DEMO_PROJECT_CODES } from "../../database/seeds/demo/catalog.js";
import { Agency } from "../agencies/models/agency.model.js";
import { Asset } from "../assets/models/asset.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { Project } from "../projects/models/project.model.js";
import { projectScopeFilter } from "../projects/projects.service.js";
import { accessFilter } from "../roadsync/conflict-record.read.js";
import { whoIs } from "../roadsync/conflict-record.service.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";
import { WorkRequest } from "../roadsync/models/work-request.model.js";
import { readFilter as workRequestFilter } from "../roadsync/work-requests.service.js";
import { contextOf, exposure, featureDetail, focalOf } from "./inframap.context.service.js";
import { visibleAssetFilter } from "./inframap.access.js";
import { isOverdueWork, transportGeometry } from "./inframap.geo.js";
import type { LayerId } from "./inframap.filters.js";

/**
 * Drawer detail for all six layers: tier-projected properties, related records the viewer may see, real web routes,
 * a hazard-exposure summary, full geometry (within the viewer's scope) and capability flags. Out-of-scope ids answer 404.
 */
const MS = 1500;
const DEMO = new Set<string>(DEMO_PROJECT_CODES);
const iso = (d: unknown) => (d ? new Date(d as string | number | Date).toISOString() : null);
const NOT_FOUND = { ok: false as const, status: 404 as const, code: "NOT_FOUND" };
type Related = { layer: LayerId; id: string; title: string; status: string | null; relation: string };

const LINKS: Partial<Record<LayerId, (id: string) => string>> = {
  projects: (id) => `/projects/${id}/overview`, roadworks: (id) => `/roadsync/work-requests/${id}`, conflicts: (id) => `/roadsync/conflicts/${id}`,
};

export async function featureDetailAll(actor: AuthenticatedActor, layer: LayerId, id: string) {
  const ctx = await contextOf(actor);
  const oid = new mongoose.Types.ObjectId(id);
  const focal = await focalOf(ctx, actor, layer, id);
  if (!focal) return NOT_FOUND;
  const related: Related[] = [];
  type Base = { kind: string; properties: Record<string, unknown>; maintenance?: unknown; reasons?: string[] };
  let base = null as Base | null;
  let recordLink: string | null = LINKS[layer]?.(id) ?? null;

  if (layer === "assets" || layer === "utilities" || layer === "risks") {
    const r = await featureDetail(actor, layer, id);
    if (!r.ok) return NOT_FOUND;
    base = r.data as unknown as Base;
    if (layer === "risks" && (base!.properties.kind === "project")) {
      recordLink = LINKS.projects!(id);
      related.push({ layer: "projects", id, title: String(base!.properties.title ?? ""), status: null, relation: "project" });
    }
    if (layer !== "risks" && typeof base!.properties.sourceProjectId === "string") {
      related.push({ layer: "projects", id: base!.properties.sourceProjectId as string, title: String(base!.properties.sourceProjectTitle ?? ""), status: null, relation: "sourceProject" });
    }
  } else if (layer === "projects") {
    const scoped = await projectScopeFilter(actor);
    const p = scoped ? await Project.findOne({ $and: [scoped, { _id: oid }] }).select("projectCode title projectType status agencyId location startDate plannedEndDate").lean() : null;
    if (!p) return NOT_FOUND;
    const agency = await Agency.findById(p.agencyId).select("name").lean();
    base = { kind: "project", properties: {
      id, layer, projectCode: p.projectCode, title: p.title, projectType: p.projectType, status: p.status, agencyName: agency?.name ?? null, district: p.location?.district ?? null, province: p.location?.province ?? null,
      locality: p.location?.locality ?? null, roadName: p.location?.roadName ?? null, startDate: iso(p.startDate), plannedEndDate: iso(p.plannedEndDate), isDelayed: p.status === "DELAYED",
      provenance: DEMO.has(p.projectCode) ? "DEMO" : "LIVE", isDemo: DEMO.has(p.projectCode),
    } };
    if (ctx.has("roadsync.work_request.read")) {
      const wr = await WorkRequest.find({ $and: [await workRequestFilter(actor), { projectId: oid }] }).select("workType status").sort({ plannedStart: 1 }).limit(10).maxTimeMS(MS).lean();
      related.push(...wr.map((w) => ({ layer: "roadworks" as const, id: w._id.toString(), title: w.workType.replace(/_/g, " ").toLowerCase(), status: w.status, relation: "roadwork" })));
    }
    if (ctx.has("asset.read")) {
      const as = await Asset.find({ $and: [visibleAssetFilter(ctx.viewer), { sourceProjectId: oid }] }).select("name assetType condition").limit(10).maxTimeMS(MS).lean();
      related.push(...as.map((a) => ({ layer: (["WATER", "DRAINAGE", "ELECTRICITY", "TELECOM"].includes(a.assetType) ? "utilities" : "assets") as LayerId, id: a._id.toString(), title: a.name, status: a.condition, relation: "asset" })));
    }
  } else if (layer === "roadworks") {
    const w = await WorkRequest.findOne({ $and: [await workRequestFilter(actor), { _id: oid }] }).select("workType status priority plannedStart plannedEnd agencyId projectId assessment").lean() as unknown as { workType: string; status: string; priority: string; plannedStart: Date; plannedEnd: Date; agencyId: mongoose.Types.ObjectId; projectId: mongoose.Types.ObjectId; assessment?: { maxBand?: string; riskIndex?: number } | null } | null;
    if (!w) return NOT_FOUND;
    const [agency, project] = await Promise.all([Agency.findById(w.agencyId).select("name").lean(), Project.findById(w.projectId).select("projectCode title").lean()]);
    const late = isOverdueWork(w.status, w.plannedEnd);
    base = { kind: "roadwork", properties: {
      id, layer, workType: w.workType, status: w.status, priority: w.priority, plannedStart: iso(w.plannedStart), plannedEnd: iso(w.plannedEnd), agencyName: agency?.name ?? null,
      projectId: w.projectId.toString(), projectTitle: project?.title ?? null, projectCode: project?.projectCode ?? null, maxBand: w.assessment?.maxBand ?? null, riskIndex: w.assessment?.riskIndex ?? null,
      isOverdue: late, displayStatus: late ? "overdue" : w.status, provenance: project && DEMO.has(project.projectCode) ? "DEMO" : "LIVE", isDemo: Boolean(project && DEMO.has(project.projectCode)),
    } };
    const scoped = ctx.has("project.read") ? await projectScopeFilter(actor) : null;
    if (scoped && project) { const visible = await Project.exists({ $and: [scoped, { _id: w.projectId }] }); if (visible) related.push({ layer: "projects", id: w.projectId.toString(), title: project.title, status: null, relation: "project" }); }
    if (ctx.has("roadsync.conflict.read")) {
      const cs = (await ConflictRecord.find({ $and: [accessFilter(await whoIs(actor)), { $or: [{ aId: oid }, { bId: oid }] }] }).select("conflictNo status severity.current").limit(10).maxTimeMS(MS).lean()) as unknown as { _id: mongoose.Types.ObjectId; conflictNo: string; status: string }[];
      related.push(...cs.map((c) => ({ layer: "conflicts" as const, id: c._id.toString(), title: c.conflictNo, status: c.status, relation: "conflict" })));
    }
  } else {
    const c = (await ConflictRecord.findOne({ $and: [accessFilter(await whoIs(actor)), { _id: oid }] }).select("conflictNo recordType status district severity.current overlapWindow resolution.state agencyIds aId bId aType bType").lean()) as unknown as { conflictNo: string; recordType: string; status: string; district?: string | null; severity?: { current?: { band?: string; score?: number } }; overlapWindow?: { start?: Date; end?: Date } | null; resolution?: { state?: string } | null; agencyIds?: unknown[]; aId: mongoose.Types.ObjectId; bId: mongoose.Types.ObjectId; aType: string; bType: string } | null;
    if (!c) return NOT_FOUND;
    base = { kind: "conflict", properties: {
      id, layer, conflictNo: c.conflictNo, recordType: c.recordType, status: c.status, band: c.severity?.current?.band ?? null, score: c.severity?.current?.score ?? null, district: c.district ?? null,
      overlapStart: iso(c.overlapWindow?.start), overlapEnd: iso(c.overlapWindow?.end), resolutionState: c.resolution?.state ?? null, affectedAgencyCount: c.agencyIds?.length ?? 0, provenance: "LIVE", isDemo: false,
    } };
    // Sides stay in RoadSync (its redaction applies); only in-scope work requests are linked, never titles of other agencies' items.
    if (ctx.has("roadsync.work_request.read")) {
      const ids = [c.aType === "work_request" ? c.aId : null, c.bType === "work_request" ? c.bId : null].filter((x): x is mongoose.Types.ObjectId => x !== null);
      if (ids.length) {
        const ws = await WorkRequest.find({ $and: [await workRequestFilter(actor), { _id: { $in: ids } }] }).select("workType status").limit(2).maxTimeMS(MS).lean();
        related.push(...ws.map((w) => ({ layer: "roadworks" as const, id: w._id.toString(), title: w.workType.replace(/_/g, " ").toLowerCase(), status: w.status, relation: "roadwork" })));
      }
    }
  }

  // Exposure summary reuses the Batch 02 lookup (its scope and tier rules apply); absent when the viewer lacks risk.read.
  const ex = ctx.has("risk.read") ? await exposure(actor, layer, id) : null;
  type Bucket = { total: number } | null;
  const exd = ex && ex.ok ? (ex.data as unknown as { mode: string; zones?: unknown[]; worstLevel?: string | null; records?: Record<string, Bucket> }) : null;
  const exposureSummary = exd
    ? exd.mode === "zones" ? { mode: "zones", zones: exd.zones?.length ?? 0, worstLevel: exd.worstLevel ?? null } : { mode: "records", projects: exd.records?.projects?.total ?? null, roadworks: exd.records?.roadworks?.total ?? null, assets: exd.records?.assets?.total ?? null, utilities: exd.records?.utilities?.total ?? null }
    : null;
  const geometry = transportGeometry(focal.geometry);
  return { ok: true as const, data: {
    kind: base!.kind, properties: base!.properties, maintenance: base!.maintenance ?? [], reasons: base!.reasons ?? [], related,
    links: { record: recordLink }, exposure: exposureSummary, provenance: base!.properties.provenance ?? null, geometry,
    actions: { canOpenRecord: recordLink !== null, canShowNearby: geometry !== null, canExposure: ctx.has("risk.read"), canZoom: geometry !== null },
  } };
}
