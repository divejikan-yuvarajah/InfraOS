import { createHash } from "node:crypto";
import type mongoose from "mongoose";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { canSee } from "./contractor.access.js";
import { assignedInScope, contextOf, Flow, need, notFound, run, visibleFilter, type Ctx, type Result } from "./contractor.context.js";
import { loadEvidenceMany, type ContractorDoc, type EvidenceMeta } from "./contractor-evidence.js";
import { evaluate, type Evaluation } from "./contractor-performance.rules.js";
import { riskHooks } from "./contractor.service.js";
import { Contractor } from "./models/contractor.model.js";

type Id = mongoose.Types.ObjectId;
const DAY = 86_400_000;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
/** Risk ranking and the summary distribution never evaluate more than this many contractors per request, and say so when they stop. */
export const RANK_CAP = 200;

type Computed = { evaluation: Evaluation; meta: EvidenceMeta; series: { delay: { projectCode: string; at: string; delayDays: number }[] } };
const cache = new Map<string, { at: number; value: Computed }>();
export const clearPerformanceCache = (): void => cache.clear();
export const performanceCacheSize = (): number => cache.size;

/** A cached result is reused only for the exact same contractor version, scope and field tiers, so no scope can read another's evidence. */
function keyOf(ctx: Ctx, doc: ContractorDoc & { updatedAt?: Date }): string {
  const scope = ctx.scope.kind === "platform" ? "platform" : [...ctx.viewer.agencyIds].sort().join(",");
  const flavour = `${ctx.viewer.canManage ? "m" : "d"}${ctx.viewer.platform ? "p" : "a"}`;
  return `${doc._id}|${createHash("sha1").update(`${scope}|${flavour}`).digest("hex").slice(0, 16)}|${doc.updatedAt?.getTime() ?? 0}`;
}

async function computeMany(ctx: Ctx, docs: (ContractorDoc & { updatedAt?: Date })[]): Promise<Map<string, Computed>> {
  const now = new Date();
  const result = new Map<string, Computed>();
  const missing: (ContractorDoc & { updatedAt?: Date })[] = [];
  for (const d of docs) {
    const hit = cache.get(keyOf(ctx, d));
    if (hit && now.getTime() - hit.at < CACHE_TTL_MS) result.set(String(d._id), hit.value);
    else missing.push(d);
  }
  if (missing.length) {
    const loaded = await loadEvidenceMany(ctx, missing, now);
    for (const d of missing) {
      const l = loaded.get(String(d._id))!;
      const value: Computed = {
        evaluation: evaluate(l.evidence, now), meta: l.meta,
        series: { delay: l.evidence.assignments.filter((a) => a.projectStatus === "COMPLETED" && a.plannedEndDate && a.actualEndDate).map((a) => ({ projectCode: a.projectCode, at: a.actualEndDate!.toISOString(), delayDays: Math.max(0, Math.floor((a.actualEndDate!.getTime() - a.plannedEndDate!.getTime()) / DAY)) })).sort((x, y) => x.at.localeCompare(y.at)) },
      };
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(keyOf(ctx, d), { at: now.getTime(), value });
      result.set(String(d._id), value);
    }
  }
  return result;
}

export function contractorPerformance(actor: AuthenticatedActor, rawId: string) {
  return run(async (): Promise<Result<unknown>> => {
    if (!/^[a-f0-9]{24}$/i.test(rawId)) return notFound();
    const ctx = await contextOf(actor);
    need(ctx, "contractor.performance.read");
    need(ctx, "contractor.read");
    const doc = (await Contractor.findById(rawId).lean()) as unknown as (ContractorDoc & { updatedAt?: Date }) | null;
    if (!doc || !canSee(ctx.viewer, doc, await assignedInScope(ctx, doc._id))) return notFound();
    const c = (await computeMany(ctx, [doc])).get(String(doc._id))!;
    return {
      ok: true,
      data: {
        contractorId: String(doc._id), generatedAt: new Date().toISOString(), basedOn: "projects you can access", ...c.evaluation, sample: c.meta, series: c.series,
        // Honest placeholders: these need Batch 06 inspection records, so they are reported as unavailable, never as zero.
        deferred: [{ key: "reworkFrequency", availableAfter: "inspections" }, { key: "qualityFindings", availableAfter: "inspections" }],
      },
    };
  });
}

type Banded = { band: string; level: string; high: number };

/** Bounded ranking input for the directory (risk filter/sort) and the summary. */
export async function bandsFor(_actor: AuthenticatedActor, ctx: Ctx, ids: Id[]): Promise<Map<string, Banded>> {
  if (!ctx.viewer.canPerformance) throw new Flow(403, "FORBIDDEN");
  if (ids.length > RANK_CAP) throw new Flow(503, "SERVICE_UNAVAILABLE", { reason: "too_many_to_rank", cap: RANK_CAP });
  const docs = (await Contractor.find({ _id: { $in: ids } }).lean()) as unknown as (ContractorDoc & { updatedAt?: Date })[];
  const computed = await computeMany(ctx, docs);
  return new Map([...computed].map(([id, c]) => [id, { band: c.evaluation.band, level: c.evaluation.evidenceLevel, high: c.evaluation.flags.reduce((n, f) => n + (f.severity === "HIGH" ? 100 : f.severity === "MEDIUM" ? 1 : 0), 0) }]));
}
riskHooks.bands = bandsFor;

/** Risk distribution and the attention list for the dashboard, over at most RANK_CAP visible contractors (the newest), flagged when truncated. */
export function riskSummary(actor: AuthenticatedActor) {
  return run(async (): Promise<Result<unknown>> => {
    const ctx = await contextOf(actor);
    need(ctx, "contractor.performance.read");
    need(ctx, "contractor.read");
    const vis = await visibleFilter(ctx);
    const filter = Object.keys(vis).length ? { $and: [vis, { status: { $ne: "ARCHIVED" } }] } : { status: { $ne: "ARCHIVED" } };
    const total = await Contractor.countDocuments(filter);
    const docs = (await Contractor.find(filter).sort({ updatedAt: -1, _id: 1 }).limit(RANK_CAP).lean()) as unknown as (ContractorDoc & { updatedAt?: Date })[];
    const computed = await computeMany(ctx, docs);
    const bands: Record<string, number> = { STRONG: 0, MIXED: 0, WEAK: 0, NOT_ENOUGH_EVIDENCE: 0 };
    const attention: { id: string; name: string; highFlags: number; flags: string[] }[] = [];
    for (const d of docs) {
      const c = computed.get(String(d._id))!;
      bands[c.evaluation.band] = (bands[c.evaluation.band] ?? 0) + 1;
      const high = c.evaluation.flags.filter((f) => f.severity === "HIGH");
      if (high.length) attention.push({ id: String(d._id), name: d.name, highFlags: high.length, flags: high.map((f) => f.code) });
    }
    attention.sort((a, b) => b.highFlags - a.highFlags || a.name.localeCompare(b.name));
    return { ok: true, data: { bands, attentionCount: attention.length, attention: attention.slice(0, 5), evaluated: docs.length, total, truncated: total > docs.length, basedOn: "projects you can access" } };
  });
}
