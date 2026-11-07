import type { ClientSession } from "mongoose";

import { Project } from "../projects/models/project.model.js";
import { holdersOf, notifyAsset, type AssetRow, type Id } from "./asset.common.js";
import { refreshAssetCaches } from "./asset-cache.js";
import { CONDITION_STEP, type KNOWN_CONDITIONS } from "./asset.constants.js";
import { AssetConditionAssessment } from "./models/asset-condition-assessment.model.js";

type Known = (typeof KNOWN_CONDITIONS)[number];
export type IssueInput = { key: string; title: string; severity: "MINOR" | "MAJOR" | "CRITICAL"; status: "OPEN" | "RESOLVED"; location?: string };

export type RecordedAssessment = { id: Id; condition: Known; becameActive: boolean; critical: boolean; dlpDrop: boolean };

/**
 * Appends one assessment (the ONLY way condition changes) and refreshes the caches in the same transaction.
 * A newer assessment (by assessedAt, then creation) becomes ACTIVE and supersedes the old one; an older one is stored as SUPERSEDED at birth.
 */
export async function recordAssessment(session: ClientSession, a: {
  asset: AssetRow; condition: Known; basis: "INSPECTION_VERIFIED" | "MANUAL_ENTRY"; assessedAt: Date; observations?: string; issues: IssueInput[];
  inspectionId?: Id; assessedBy: Id; reviewedBy?: Id; maintenanceRefs?: Id[];
}): Promise<RecordedAssessment> {
  const current = await AssetConditionAssessment.findOne({ assetId: a.asset._id, status: "ACTIVE" }).sort({ assessedAt: -1, createdAt: -1 }).session(session).lean();
  const becomesActive = !current || a.assessedAt.getTime() >= current.assessedAt.getTime();
  const [row] = await AssetConditionAssessment.create([{
    assetId: a.asset._id, agencyId: a.asset.agencyId, assessedAt: a.assessedAt, condition: a.condition, basis: a.basis, ...(a.inspectionId ? { inspectionId: a.inspectionId } : {}),
    ...(a.observations ? { observations: a.observations } : {}), issues: a.issues, previousCondition: current?.condition ?? a.asset.condition, assessedBy: a.assessedBy, ...(a.reviewedBy ? { reviewedBy: a.reviewedBy } : {}),
    status: becomesActive ? "ACTIVE" : "SUPERSEDED", ...(!becomesActive && current ? { supersededBy: current._id } : {}), maintenanceRefs: a.maintenanceRefs ?? [],
  }], { session });
  if (becomesActive) await AssetConditionAssessment.updateMany({ assetId: a.asset._id, status: "ACTIVE", _id: { $ne: row!._id } }, { $set: { status: "SUPERSEDED", supersededBy: row!._id } }, { session });
  await refreshAssetCaches(a.asset._id, session);
  const prevStep = current ? CONDITION_STEP[current.condition] : null;
  const dlp = a.asset.defectsLiabilityEndsOn ? a.assessedAt.getTime() <= a.asset.defectsLiabilityEndsOn.getTime() : false;
  return { id: row!._id as Id, condition: a.condition, becameActive: becomesActive, critical: becomesActive && a.condition === "CRITICAL", dlpDrop: becomesActive && dlp && prevStep !== null && CONDITION_STEP[a.condition] < prevStep };
}

/** Notices after commit: CRITICAL goes to agency approvers and officers; a drop inside the defects liability period goes to the owner officers and the project manager. */
export async function notifyAssessment(asset: AssetRow, r: RecordedAssessment, exclude: string[] = []): Promise<void> {
  const resource = { type: "ASSET" as const, id: asset._id };
  const label = asset.assetNo ?? String(asset._id);
  if (r.critical) {
    const to = [...(await holdersOf([asset.agencyId as Id], "asset.conversion.approve", exclude)), ...(await holdersOf([asset.agencyId as Id], "asset.update", exclude))];
    await notifyAsset(to, { title: "Asset in critical condition", message: `${label} was recorded as CRITICAL.`, resource, eventKey: `ast-crit:${asset._id}` });
  }
  if (r.dlpDrop) {
    const project = await Project.findById(asset.sourceProjectId).select("managerId").lean();
    const to = [...(await holdersOf([asset.agencyId as Id], "asset.update", exclude)), ...(project?.managerId ? [project.managerId as Id] : [])];
    await notifyAsset(to, { title: "Condition dropped during the defects liability period", message: `${label}: consider notifying the contractor.`, resource, eventKey: `ast-dlp:${asset._id}:${String(r.id).slice(-8)}` });
  }
}
