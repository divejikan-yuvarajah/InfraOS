import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { mapProjects } from "../projects/projects.service.js";
import { accessFilter } from "../roadsync/conflict-record.read.js";
import { whoIs } from "../roadsync/conflict-record.service.js";
import { ConflictRecord } from "../roadsync/models/conflict-record.model.js";
import { assertLive, FlowControl, mapWorkRequests } from "../roadsync/work-requests.service.js";
import { LAYER_FEATURE_CAP, layerCollection, viewportPolygon, type Bbox, type LayerCollection } from "./inframap.geo.js";

export type LayerResult = { ok: true; layer: LayerCollection } | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 503; code: string };

const iso = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);

/** Projects with a recorded geometry in the viewport, under the catalog's read scope (Step 82). */
export async function projectLayer(actor: AuthenticatedActor, bbox: Bbox): Promise<LayerResult> {
  const result = await mapProjects(actor, bbox);
  if (!result.ok) return { ok: false, status: result.status, code: result.code };
  return {
    ok: true,
    layer: layerCollection(
      result.rows.map((row) => ({
        geometry: row.geometry,
        properties: {
          id: row.id, projectCode: row.projectCode, title: row.title, projectType: row.projectType, status: row.status,
          agencyName: row.agencyName, startDate: iso(row.startDate), plannedEndDate: iso(row.plannedEndDate),
        },
      })),
      result.truncated,
    ),
  };
}

/** Work requests in the viewport under the existing work-request read scope: an agency never sees another agency's requests here (Step 83). */
export async function workRequestLayer(actor: AuthenticatedActor, bbox: Bbox): Promise<LayerResult> {
  const result = await mapWorkRequests(actor, { bbox });
  if (!result.ok) return { ok: false, status: result.status, code: result.code };
  return {
    ok: true,
    layer: layerCollection(
      result.map.features.map((feature) => {
        const p = feature.properties as Record<string, unknown>;
        return {
          geometry: feature.geometry,
          properties: {
            id: p.id, workType: p.workType, status: p.status, priority: p.priority, plannedStart: p.plannedStart, plannedEnd: p.plannedEnd,
            maxBand: p.maxBand ?? null, agencyName: p.agencyName ?? null, projectTitle: p.projectTitle ?? null, projectCode: p.projectCode ?? null,
          },
        };
      }),
      result.map.truncated,
    ),
  };
}

/**
 * Conflict hotspots in the viewport that involve the viewer's agencies (everything for SUPER_ADMIN), worst first (Step 84).
 * Only the hotspot point, number, band, score and status leave; sides, notes and other agencies' fields are never selected.
 */
export async function conflictLayer(actor: AuthenticatedActor, bbox: Bbox): Promise<LayerResult> {
  try {
    await assertLive(actor, ["roadsync.conflict.read"]);
    const who = await whoIs(actor);
    const rows = (await ConflictRecord.find({
      $and: [accessFilter(who), { recordType: "conflict" }, { hotspot: { $geoWithin: { $geometry: viewportPolygon(bbox) } } }],
    })
      .select("conflictNo status severity.current hotspot overlapWindow resolution.state")
      .sort({ "severity.current.score": -1, _id: 1 })
      .limit(LAYER_FEATURE_CAP + 1)
      .lean()) as unknown as {
      _id: { toString(): string }; conflictNo: string; status: string; hotspot: unknown;
      severity?: { current?: { band?: string; score?: number } }; overlapWindow?: { start?: Date; end?: Date } | null; resolution?: { state?: string } | null;
    }[];
    return {
      ok: true,
      layer: layerCollection(
        rows.slice(0, LAYER_FEATURE_CAP).map((row) => ({
          geometry: row.hotspot,
          properties: {
            id: row._id.toString(), conflictNo: row.conflictNo, status: row.status,
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
