/**
 * Steps 74-75 impact preview: the Step 71 scoring engine re-run with a proposed schedule override on EITHER side of
 * the pair. Scoring rules and defaults are untouched; nothing here is persisted. Output is scores, bands and counts
 * only (never the other side's priority, emergency, flexibility, cost, description or contact).
 */
import mongoose from "mongoose";

import { assessPair, riskIndexOf } from "./assessment.engine.js";
import { bandOf, type Band } from "./assessment.rules.js";
import { scheduleOverrides, type Proposal } from "./coordination.engine.js";
import { itemSide, loadItems, type SourceItem } from "./detection.service.js";
import { Candidate } from "./models/candidate.model.js";
import { analyzeSchedules, type ScheduleSide, type TemporalResult } from "./schedule.analysis.js";
import type { SpatialResult } from "./spatial.analysis.js";

const oid = (id: string) => new mongoose.Types.ObjectId(id);
type PairDoc = { _id: mongoose.Types.ObjectId; aType: "work_request" | "project" | "asset"; aId: mongoose.Types.ObjectId; bType: "work_request" | "project" | "asset"; bId: mongoose.Types.ObjectId; spatial: SpatialResult; temporal: TemporalResult };
export type Outcome = { riskIndex: number; maxBand: Band | null; conflictCount: number; pairScore: number; pairBand: Band; pairKind: string };
export type Impact = { applicable: false } | { applicable: true; before: Outcome; after: Outcome; verdict: "clears" | "lowers" | "none" | "raises"; proposed: { requestId: string; start: string | null; end: string | null; workingHours: string | null } };

const sched = (s: { start: Date; end: Date; workingHours: ScheduleSide["workingHours"] }): ScheduleSide => ({ start: s.start, end: s.end, workingHours: s.workingHours, flexibleDays: 0, isEmergency: false });

/**
 * @param subjectId  the work request whose pairs define the request-level numbers (the viewer's own request).
 * @param pairCandidateId  the record's pair, reported separately as pairScore/pairBand.
 */
export async function computeImpact(subjectId: string, pairCandidateId: string, proposal: Proposal): Promise<Impact> {
  const o = scheduleOverrides(proposal);
  if (!o) return { applicable: false };
  const docs = (await Candidate.find({ status: "active", $or: [{ aType: "work_request", aId: oid(subjectId) }, { bType: "work_request", bId: oid(subjectId) }] }).limit(200).lean()) as unknown as PairDoc[];
  const refs = new Map<string, { type: "work_request" | "project" | "asset"; id: string }>();
  for (const d of docs) { refs.set(`${d.aType}:${d.aId}`, { type: d.aType, id: String(d.aId) }); refs.set(`${d.bType}:${d.bId}`, { type: d.bType, id: String(d.bId) }); }
  const items = await loadItems([...refs.values()]);

  const evaluate = (apply: boolean): Outcome => {
    const scores: number[] = [];
    let pair: { score: number; band: Band; kind: string } = { score: 0, band: "info", kind: "advisory" };
    for (const d of docs) {
      const a = items.get(`${d.aType}:${d.aId}`);
      const b = items.get(`${d.bType}:${d.bId}`);
      if (!a || !b) continue;
      const side = (item: SourceItem) => {
        const base = itemSide(item);
        if (!apply || item.type !== "work_request" || item.id !== o.requestId) return base;
        return { ...base, start: o.start ?? base.start, end: o.end ?? base.end, workingHours: o.workingHours ?? base.workingHours };
      };
      const sa = side(a);
      const sb = side(b);
      let temporal = d.temporal;
      if (sa.sourceType !== "asset" && sb.sourceType !== "asset" && sa.start && sa.end && sb.start && sb.end) {
        temporal = analyzeSchedules(sched({ start: sa.start, end: sa.end, workingHours: sa.workingHours }), sched({ start: sb.start, end: sb.end, workingHours: sb.workingHours }));
      }
      const r = assessPair(sa, sb, d.spatial, temporal);
      if (r.kind === "conflict") scores.push(r.score);
      if (String(d._id) === pairCandidateId) pair = { score: r.score, band: r.band, kind: r.kind };
    }
    const top = Math.max(0, ...scores);
    return { riskIndex: riskIndexOf(scores), maxBand: scores.length ? bandOf(top) : null, conflictCount: scores.length, pairScore: pair.score, pairBand: pair.band, pairKind: pair.kind };
  };
  const before = evaluate(false);
  const after = evaluate(true);
  const verdict = after.pairKind !== "conflict" && before.pairKind === "conflict" ? "clears" : after.pairScore < before.pairScore ? "lowers" : after.pairScore > before.pairScore ? "raises" : "none";
  return { applicable: true, before, after, verdict, proposed: { requestId: o.requestId, start: o.start?.toISOString() ?? null, end: o.end?.toISOString() ?? null, workingHours: o.workingHours ?? null } };
}
