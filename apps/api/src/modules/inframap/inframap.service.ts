import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { Project } from "../projects/models/project.model.js";
import { mapProjects, projectsWithoutLocation } from "../projects/projects.service.js";
import { accessFilter } from "../roadsync/conflict-record.read.js";
import { whoIs } from "../roadsync/conflict-record.service.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";
import { assertLive, FlowControl, mapWorkRequests } from "../roadsync/work-requests.service.js";
import { conflictNarrow, projectNarrow, roadworkNarrow, type LayerQ, type NF } from "./inframap.filters.js";
import { isOverdueWork, layerCollection, viewportPolygon, type Bbox, type LayerCollection } from "./inframap.geo.js";

export type LayerResult = { ok: true; layer: LayerCollection } | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 503; code: string };

const iso = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);
const shape = (q: LayerQ, layer: string) => ({ limit: q.limit, zoom: q.zoom, fields: q.fields, layer });

/** Projects with a recorded geometry in the viewport, under the catalog's read scope (Step 82). */
export async function projectLayer(actor: AuthenticatedActor, bbox: Bbox, q: LayerQ): Promise<LayerResult> {
  const result = await mapProjects(actor, bbox, projectNarrow(q.nf), q.limit);
  if (!result.ok) return { ok: false, status: result.status, code: result.code };
  const layer = layerCollection(
    result.rows.map((row) => ({
      geometry: row.geometry,
      properties: {
        id: row.id, projectCode: row.projectCode, title: row.title, projectType: row.projectType, status: row.status,
        agencyName: row.agencyName, district: row.district, province: row.province,
        startDate: iso(row.startDate), plannedEndDate: iso(row.plannedEndDate),
        isDelayed: row.status === "DELAYED", geometryType: (row.geometry as { type?: string } | null)?.type ?? null,
      },
    })),
    result.truncated, shape(q, "projects"),
  );
  return { ok: true, layer: { ...layer, ...(result.total !== undefined ? { total: result.total } : {}) } };
}

/** Work requests have no place of their own: province and district resolve through the project's recorded location. */
export async function projectIdsInLocation(nf: NF): Promise<import("mongoose").Types.ObjectId[] | null> {
  if (!nf.province.length && !nf.district.length) return null;
  const ids = await Project.find({ $and: [projectNarrow({ ...nf, projectStatus: [], projectType: [], agencyId: [], dateFrom: undefined as never, dateTo: undefined as never })] }).select("_id").limit(5000).maxTimeMS(1500).lean();
  return ids.map((p) => p._id);
}

/** Work requests in the viewport under the existing work-request read scope: an agency never sees another agency's requests here (Step 83). */
export async function roadworkLayer(actor: AuthenticatedActor, bbox: Bbox, q: LayerQ): Promise<LayerResult> {
  const result = await mapWorkRequests(actor, { bbox, extra: roadworkNarrow(q.nf, await projectIdsInLocation(q.nf)), limit: q.limit });
  if (!result.ok) return { ok: false, status: result.status, code: result.code };
  const layer = layerCollection(
    result.map.features.map((feature) => {
      const p = feature.properties as Record<string, unknown>;
      // Overdue is derived here from the planned end; no "delayed" state is stored for a work request.
      const isOverdue = isOverdueWork(p.status, p.plannedEnd);
      return {
        geometry: feature.geometry,
        properties: {
          id: p.id, workType: p.workType, status: p.status, priority: p.priority, plannedStart: p.plannedStart, plannedEnd: p.plannedEnd,
          maxBand: p.maxBand ?? null, riskIndex: p.riskIndex ?? null, agencyName: p.agencyName ?? null, projectTitle: p.projectTitle ?? null, projectCode: p.projectCode ?? null,
          isOverdue, displayStatus: isOverdue ? "overdue" : p.status,
        },
      };
    }),
    result.map.truncated, shape(q, "roadworks"),
  );
  return { ok: true, layer: { ...layer, ...("total" in result.map && result.map.total !== undefined ? { total: result.map.total as number } : {}) } };
}

/**
 * Conflict hotspots in the viewport that involve the viewer's agencies (everything for SUPER_ADMIN), worst first (Step 84).
 * Only the hotspot point, number, band, score and status leave; sides, notes and other agencies' fields are never selected.
 */
export async function conflictLayer(actor: AuthenticatedActor, bbox: Bbox, q: LayerQ): Promise<LayerResult> {
  try {
    await assertLive(actor, ["roadsync.conflict.read"]);
    const who = await whoIs(actor);
    const query = { $and: [accessFilter(who), conflictNarrow(q.nf), { hotspot: { $geoWithin: { $geometry: viewportPolygon(bbox) } } }] };
    const rows = (await ConflictRecord.find(query)
      .select("conflictNo status district severity.current hotspot overlapWindow resolution.state")
      .sort({ "severity.current.score": -1, _id: 1 })
      .limit(q.limit + 1)
      .maxTimeMS(3000)
      .lean()) as unknown as {
      _id: { toString(): string }; conflictNo: string; status: string; district?: string | null; hotspot: unknown;
      severity?: { current?: { band?: string; score?: number } }; overlapWindow?: { start?: Date; end?: Date } | null; resolution?: { state?: string } | null;
    }[];
    const truncated = rows.length > q.limit;
    const total = truncated ? await ConflictRecord.countDocuments(query).maxTimeMS(1500).catch(() => undefined) : undefined;
    const layer = layerCollection(
      rows.slice(0, q.limit).map((row) => ({
        geometry: row.hotspot,
        properties: {
          id: row._id.toString(), conflictNo: row.conflictNo, status: row.status, district: row.district ?? null,
          band: row.severity?.current?.band ?? null, score: row.severity?.current?.score ?? null,
          resolutionState: row.resolution?.state ?? null,
          overlapStart: iso(row.overlapWindow?.start), overlapEnd: iso(row.overlapWindow?.end),
        },
      })),
      truncated, shape(q, "conflicts"),
    );
    return { ok: true, layer: { ...layer, ...(total !== undefined ? { total } : {}) } };
  } catch (error) {
    if (error instanceof FlowControl) return { ok: false, status: error.status, code: error.code };
    return { ok: false, status: 503, code: "SERVICE_UNAVAILABLE" };
  }
}

export type LayerAvailability = { id: "projects" | "roadworks" | "conflicts" | "assets" | "utilities" | "risks"; available: boolean; reason?: "forbidden" | "unavailable" };
export type LayersInfo = { layers: LayerAvailability[]; projectsWithoutLocation: { total: number; items: { id: string; projectCode: string; title: string }[] } };

/**
 * Which layers this user may load. Derived from the live role document and the layers' own read permissions, so a
 * forbidden layer never makes the others fail. It also lists in-scope projects that have no map location.
 */
export async function layersInfo(actor: AuthenticatedActor): Promise<LayersInfo> {
  const role = await Role.findById(actor.roleId).select("permissions isActive key");
  const granted = role?.isActive && role.key === actor.roleKey && Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
  const entry = (id: LayerAvailability["id"], permission: "project.read" | "roadsync.work_request.read" | "roadsync.conflict.read" | "asset.read" | "risk.read"): LayerAvailability =>
    hasPermission(granted, permission) ? { id, available: true } : { id, available: false, reason: "forbidden" };
  const layers = [entry("projects", "project.read"), entry("roadworks", "roadsync.work_request.read"), entry("conflicts", "roadsync.conflict.read"), entry("assets", "asset.read"), entry("utilities", "asset.read"), entry("risks", "risk.read")];
  let missing: LayersInfo["projectsWithoutLocation"] = { total: 0, items: [] };
  const projects = layers[0]!;
  if (projects.available) {
    try {
      const result = await projectsWithoutLocation(actor);
      if (result.ok) missing = { total: result.total, items: result.items };
      else { projects.available = false; projects.reason = "forbidden"; }
    } catch {
      projects.available = false; projects.reason = "unavailable";
    }
  }
  return { layers, projectsWithoutLocation: missing };
}
