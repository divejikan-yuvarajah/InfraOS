import type { ClientSession } from "mongoose";

import { HazardZone } from "../risk/models/hazard-zone.model.js";
import { DEFAULT_MONITORING_DAYS, type AssetType } from "./asset.constants.js";
import type { Id } from "./asset.common.js";
import { computeHealth, type Hazard, type HealthResult } from "./asset-health.rules.js";
import { evaluateCondition } from "./condition-rules.js";
import { coupledStatus } from "./maintenance-workflow.js";
import { AssetConditionAssessment } from "./models/asset-condition-assessment.model.js";
import { Asset } from "./models/asset.model.js";
import { MaintenanceRecord } from "./models/maintenance-record.model.js";

const LEVEL_ORDER: Hazard[] = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"];

/** Highest hazard level intersecting the asset geometry. undefined = the check cannot be made (no geometry or no hazard data loaded). */
async function hazardOf(geometry: unknown): Promise<Hazard | undefined> {
  if (!geometry) return undefined;
  try {
    if ((await HazardZone.estimatedDocumentCount()) === 0) return undefined;
    const zones = await HazardZone.find({ geometry: { $geoIntersects: { $geometry: geometry as never } } }).select("level").limit(50).maxTimeMS(3000).lean();
    if (!zones.length) return null;
    return zones.map((z) => z.level as Hazard).sort((a, b) => LEVEL_ORDER.indexOf(b) - LEVEL_ORDER.indexOf(a))[0] ?? null;
  } catch { return undefined; }
}

export type AssetFacts = { _id: Id; assetType: string; monitoringIntervalDays?: number | null; geometry?: unknown; operationalStatus?: string | null; defectsLiabilityEndsOn?: Date | null; handoverAt?: Date | null };

/** The single place that recomputes health and condition flags from the stored evidence. Pure rules, real data in. */
export async function computeAssetState(asset: AssetFacts, now = new Date(), session?: ClientSession) {
  const intervalDays = asset.monitoringIntervalDays ?? DEFAULT_MONITORING_DAYS[asset.assetType as AssetType] ?? 365;
  const aq = AssetConditionAssessment.find({ assetId: asset._id, status: "ACTIVE" }).sort({ assessedAt: -1, createdAt: -1 }).limit(6);
  const mq = MaintenanceRecord.find({ assetId: asset._id }).select("status priority scheduledDate requestedAt maintenanceType").sort({ scheduledDate: -1 }).limit(500);
  if (session) { aq.session(session); mq.session(session); }
  const [assessments, maintenance, hazard] = await Promise.all([aq.lean(), mq.lean(), hazardOf(asset.geometry)]);
  const latest = assessments[0];
  const health: HealthResult = computeHealth({
    now, intervalDays,
    assessment: latest ? { condition: latest.condition, assessedAt: latest.assessedAt, basis: latest.basis, issues: latest.issues.map((x) => ({ severity: x.severity, status: x.status })) } : null,
    maintenance: maintenance.map((m) => ({ status: m.status, priority: m.priority ?? null, scheduledDate: m.scheduledDate, requestedAt: m.requestedAt ?? null })), hazard,
  });
  const condition = evaluateCondition({
    now, intervalDays, operationalStatus: asset.operationalStatus ?? "IN_SERVICE", defectsLiabilityEndsOn: asset.defectsLiabilityEndsOn ?? null, handoverAt: asset.handoverAt ?? null,
    assessments: assessments.map((a) => ({ condition: a.condition, assessedAt: a.assessedAt, issues: a.issues.map((x) => ({ key: x.key, severity: x.severity, status: x.status })) })),
  });
  return { intervalDays, latest, assessments, maintenance, health, condition };
}

/**
 * Refreshes the server-maintained caches (condition, lastInspectionAt, nextMaintenanceAt, healthScore) from the stored evidence.
 * Called inside the same transaction as every assessment, maintenance or status change. `coupleStatus` also applies the single
 * IN_SERVICE / UNDER_MAINTENANCE coupling. healthScore is UNSET (never 0) when the evidence is insufficient.
 */
export async function refreshAssetCaches(assetId: Id, session: ClientSession, opts: { coupleStatus?: boolean } = {}): Promise<HealthResult | null> {
  const asset = (await Asset.findById(assetId).session(session).lean()) as (AssetFacts & { operationalStatus?: string }) | null;
  if (!asset) return null;
  const state = await computeAssetState(asset, new Date(), session);
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  if (state.latest) { $set.condition = state.latest.condition; $set.lastInspectionAt = state.latest.assessedAt; }
  const upcoming = state.maintenance.filter((m) => m.status === "PLANNED" || m.status === "SCHEDULED" || m.status === "IN_PROGRESS").map((m) => m.scheduledDate.getTime());
  if (upcoming.length) $set.nextMaintenanceAt = new Date(Math.min(...upcoming)); else $unset.nextMaintenanceAt = 1;
  if (state.health.score !== null) $set.healthScore = state.health.score; else $unset.healthScore = 1;
  if (opts.coupleStatus) {
    const next = coupledStatus((asset.operationalStatus ?? "IN_SERVICE") as never, state.maintenance.filter((m) => m.status === "IN_PROGRESS").length);
    if (next !== asset.operationalStatus) $set.operationalStatus = next;
  }
  await Asset.updateOne({ _id: assetId }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) }, { session, timestamps: false });
  return state.health;
}
