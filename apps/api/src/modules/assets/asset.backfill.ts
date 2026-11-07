import { nextNumber } from "../../shared/database/counter.js";
import { Project } from "../projects/models/project.model.js";
import { DEFAULT_MONITORING_DAYS, type AssetType } from "./asset.constants.js";
import { Asset } from "./models/asset.model.js";
import { MaintenanceRecord } from "./models/maintenance-record.model.js";

export type AssetBackfillReport = { mode: "dry-run" | "commit"; assets: { scanned: number; numbered: number }; maintenance: { scanned: number; numbered: number; overdueNormalised: number } };

/**
 * Idempotent. Gives legacy assets a number, a LEGACY origin and defaults, and numbers legacy maintenance rows.
 * Legacy `condition` values stay as they are (shown as "legacy, no assessment recorded") and NO assessment rows are invented.
 * A stored OVERDUE maintenance status is normalised to SCHEDULED because overdue is derived from the date.
 */
export async function backfillAssets(commit: boolean): Promise<AssetBackfillReport> {
  const assets = await Asset.find({ $or: [{ assetNo: { $exists: false } }, { origin: { $exists: false } }] }).select("assetNo origin sourceProjectId assetType operationalStatus constructionAgencyId monitoringIntervalDays version createdAt").sort({ createdAt: 1 }).lean();
  let aNum = 0;
  for (const a of assets) {
    const $set: Record<string, unknown> = {};
    if (!a.assetNo) { aNum += 1; if (commit) $set.assetNo = await nextNumber("AST", a.createdAt ?? new Date()); }
    if (!a.origin) $set.origin = "LEGACY";
    if (!a.operationalStatus) $set.operationalStatus = "IN_SERVICE";
    if (!a.monitoringIntervalDays) $set.monitoringIntervalDays = DEFAULT_MONITORING_DAYS[a.assetType as AssetType] ?? 365;
    if (a.version === undefined) $set.version = 0;
    if (!a.constructionAgencyId) { const p = await Project.findById(a.sourceProjectId).select("agencyId").lean(); if (p?.agencyId) $set.constructionAgencyId = p.agencyId; }
    if (commit && Object.keys($set).length) await Asset.updateOne({ _id: a._id }, { $set }, { timestamps: false });
  }
  const rows = await MaintenanceRecord.find({ $or: [{ maintenanceNo: { $exists: false } }, { status: "OVERDUE" }] }).select("maintenanceNo assetId status priority origin version createdAt").sort({ createdAt: 1 }).lean();
  let mNum = 0, overdue = 0;
  for (const m of rows) {
    const $set: Record<string, unknown> = {};
    if (!m.maintenanceNo) {
      mNum += 1;
      if (commit) $set.maintenanceNo = await nextNumber("MNT", m.createdAt ?? new Date());
      const a = await Asset.findById(m.assetId).select("agencyId").lean();
      if (a?.agencyId) $set.agencyId = a.agencyId;
    }
    if (m.status === "OVERDUE") { overdue += 1; $set.status = "SCHEDULED"; }
    if (!m.priority) $set.priority = "NORMAL";
    if (!m.origin) $set.origin = "PLANNED";
    if (m.version === undefined) $set.version = 0;
    if (commit && Object.keys($set).length) await MaintenanceRecord.updateOne({ _id: m._id }, { $set }, { timestamps: false });
  }
  return { mode: commit ? "commit" : "dry-run", assets: { scanned: assets.length, numbered: aNum }, maintenance: { scanned: rows.length, numbered: mNum, overdueNormalised: overdue } };
}
