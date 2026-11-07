import { computeAssetState, refreshAssetCaches } from "./asset-cache.js";
import { inTransaction } from "./asset.common.js";
import { Asset } from "./models/asset.model.js";

export type RecomputeReport = { mode: "dry-run" | "commit"; scanned: number; changed: number; unchanged: number; becomingUnavailable: number; becomingAvailable: number };

/**
 * Refreshes the persisted health cache for time-driven changes (an assessment ageing past its interval, work becoming overdue).
 * No cron: run it on demand. Dry run by default. The score itself is always recomputed on read, so the passport is never stale.
 */
export async function recomputeAssetHealth(commit: boolean, now = new Date()): Promise<RecomputeReport> {
  const assets = await Asset.find({ operationalStatus: { $ne: "DECOMMISSIONED" } }).select("assetType monitoringIntervalDays geometry operationalStatus defectsLiabilityEndsOn handoverAt healthScore").limit(5000).lean();
  let changed = 0, unchanged = 0, gone = 0, appeared = 0;
  for (const a of assets) {
    const next = (await computeAssetState(a as never, now)).health.score;
    const cur = a.healthScore ?? null;
    if (next === cur) { unchanged += 1; continue; }
    changed += 1;
    if (next === null) gone += 1;
    if (cur === null) appeared += 1;
    if (commit) await inTransaction((session) => refreshAssetCaches(a._id, session));
  }
  return { mode: commit ? "commit" : "dry-run", scanned: assets.length, changed, unchanged, becomingUnavailable: gone, becomingAvailable: appeared };
}
