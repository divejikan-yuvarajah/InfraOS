import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { mapProjects, projectsWithoutLocation } from "../projects/projects.service.js";
import { accessFilter } from "../roadsync/conflict-record.read.js";
import { whoIs } from "../roadsync/conflict-record.service.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";
import { assertLive, FlowControl, mapWorkRequests } from "../roadsync/work-requests.service.js";
import { isOverdueWork, LAYER_FEATURE_CAP, layerCollection, viewportPolygon, type Bbox, type LayerCollection } from "./inframap.geo.js";

/** Records no longer being worked; mirrors the web map dimmed set. */
const CLOSED_STATUSES = ["resolved", "dismissed", "auto_closed", "withdrawn"] as const;

export type LayerResult = { ok: true; layer: LayerCollection } | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 503; code: string };

const iso = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);

/** Projects with a recorded geometry in the viewport, under the catalog's read scope (Step 82). */
export async function projectLayer(actor: AuthenticatedActor, bbox: Bbox, filters: { status?: string; projectType?: string } = {}): Promise<LayerResult> {
  const result = await mapProjects(actor, bbox, filters);
  if (!result.ok) return { ok: false, status: result.status, code: result.code };
  return {
    ok: true,
    layer: layerCollection(
      result.rows.map((row) => ({
        geometry: row.geometry,
        properties: {
          id: row.id, projectCode: row.projectCode, title: row.title, projectType: row.projectType, status: row.status,
          agencyName: row.agencyName, district: row.district, province: row.province,
          startDate: iso(row.startDate), plannedEndDate: iso(row.plannedEndDate),
          isDelayed: row.status === "DELAYED", geometryType: (row.geometry as { type?: string } | null)?.type ?? null,
        },
      })),
      result.truncated,
    ),
  };
}

/** Work requests in the viewport under the existing work-request read scope: an agency never sees another agency's requests here (Step 83). */
export async function roadworkLayer(actor: AuthenticatedActor, bbox: Bbox, filters: { status?: string; overdue?: string } = {}): Promise<LayerResult> {
  const result = await mapWorkRequests(actor, { bbox, ...(filters.status ? { status: filters.status } : {}) });
  if (!result.ok) return { ok: false, status: result.status, code: result.code };
  return {
    ok: true,
    layer: layerCollection(
      result.map.features.flatMap((feature) => {
        const p = feature.properties as Record<string, unknown>;
        // Overdue is derived here from the planned end; no "delayed" state is stored for a work request.
        const isOverdue = isOverdueWork(p.status, p.plannedEnd);
        if (filters.overdue && !isOverdue) return [];
        return [{
          geometry: feature.geometry,
          properties: {
            id: p.id, workType: p.workType, status: p.status, priority: p.priority, plannedStart: p.plannedStart, plannedEnd: p.plannedEnd,
            maxBand: p.maxBand ?? null, riskIndex: p.riskIndex ?? null, agencyName: p.agencyName ?? null, projectTitle: p.projectTitle ?? null, projectCode: p.projectCode ?? null,
            isOverdue, displayStatus: isOverdue ? "overdue" : p.status,
          },
        }];
      }),
      result.map.truncated,
    ),
  };
}

/**
 * Conflict hotspots in the viewport that involve the viewer's agencies (everything for SUPER_ADMIN), worst first (Step 84).
 * Only the hotspot point, number, band, score and status leave; sides, notes and other agencies' fields are never selected.
 */
export async function conflictLayer(actor: AuthenticatedActor, bbox: Bbox, filters: { band?: string; group?: string } = {}): Promise<LayerResult> {
  try {
    await assertLive(actor, ["roadsync.conflict.read"]);
    const who = await whoIs(actor);
    const rows = (await ConflictRecord.find({
      $and: [accessFilter(who), { recordType: "conflict" },
        ...(filters.band ? [{ "severity.current.band": filters.band }] : []),
        ...(filters.group ? [{ status: filters.group === "closed" ? { $in: [...CLOSED_STATUSES] } : { $nin: [...CLOSED_STATUSES] } }] : []),
        { hotspot: { $geoWithin: { $geometry: viewportPolygon(bbox) } } }],
    })
      .select("conflictNo status district severity.current hotspot overlapWindow resolution.state")
      .sort({ "severity.current.score": -1, _id: 1 })
      .limit(LAYER_FEATURE_CAP + 1)
      .lean()) as unknown as {
      _id: { toString(): string }; conflictNo: string; status: string; district?: string | null; hotspot: unknown;
      severity?: { current?: { band?: string; score?: number } }; overlapWindow?: { start?: Date; end?: Date } | null; resolution?: { state?: string } | null;
    }[];
    return {
      ok: true,
      layer: layerCollection(
        rows.slice(0, LAYER_FEATURE_CAP).map((row) => ({
          geometry: row.hotspot,
          properties: {
            id: row._id.toString(), conflictNo: row.conflictNo, status: row.status, district: row.district ?? null,
            band: row.severity?.current?.band ?? null, score: row.severity?.current?.score ?? null,
            resolutionState: row.resolution?.state ?? null,
            overlapStart: iso(row.overlapWindow?.start), overlapEnd: iso(row.overlapWindow?.end),
          },
        })),
        rows.length > LAYER_FEATURE_CAP,
      ),
    };
  } catch (error) {
    if (error instanceof FlowControl) return { ok: false, status: error.status, code: error.code };
    return { ok: false, status: 503, code: "SERVICE_UNAVAILABLE" };
  }
}

export type LayerAvailability = { id: "projects" | "roadworks" | "conflicts"; available: boolean; reason?: "forbidden" | "unavailable" };
export type LayersInfo = { layers: LayerAvailability[]; projectsWithoutLocation: { total: number; items: { id: string; projectCode: string; title: string }[] } };

/**
 * Which layers this user may load. Derived from the live role document and the layers' own read permissions, so a
 * forbidden layer never makes the others fail. It also lists in-scope projects that have no map location.
 */
export async function layersInfo(actor: AuthenticatedActor): Promise<LayersInfo> {
  const role = await Role.findById(actor.roleId).select("permissions isActive key");
  const granted = role?.isActive && role.key === actor.roleKey && Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
  const entry = (id: LayerAvailability["id"], permission: "project.read" | "roadsync.work_request.read" | "roadsync.conflict.read"): LayerAvailability =>
    hasPermission(granted, permission) ? { id, available: true } : { id, available: false, reason: "forbidden" };
  const layers = [entry("projects", "project.read"), entry("roadworks", "roadsync.work_request.read"), entry("conflicts", "roadsync.conflict.read")];
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
