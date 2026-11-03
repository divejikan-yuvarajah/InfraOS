/**
 * Step 80 deterministic advisor. Rule-based and explainable: candidate moves are generated from fixed offsets, every
 * candidate is scored by the SAME Step 79 `evaluate` (-> Step 71 `assessPair`), and plans are ranked by a displayed
 * weighted formula. No I/O, no clock (today and the budget clock are passed in), stable ordering everywhere.
 * Other agencies' requests only ever appear as "propose to counterpart" moves; their priority, emergency and flexibility
 * are never read. Output is scores, bands, counts, ids and i18n codes + params only.
 */
import { createHash } from "node:crypto";

import { BAND_CODES, RULE_VERSION } from "./assessment.rules.js";
import { OPEN_LIKE } from "./conflict-record.rules.js";
import { DEADLINE_DEFAULT_DAYS } from "./coordination.rules.js";
import { ADV, ADVISOR_VERSION, CONF, WEIGHTS, type Archetype, type Component } from "./advisor.rules.js";
import { nationalReasons } from "./resolution.engine.js";
import { RES } from "./resolution.rules.js";
import { evaluate, SIM_HOURS, type Change, type Evaluation, type Lever, type Snap, type World } from "./simulator.js";

const DAY = 86_400_000;
const BAND_ORDER: readonly string[] = ["info", "low", "medium", "high", "critical"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const live = (s: Snap) => s.kind === "conflict" && s.score >= ADV.RECORD_MIN_SCORE;
const dayStartUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export type Move = {
  kind: "shift_request" | "sequence_pair" | "set_hours"; requestId: string; agencyId: string; mine: boolean; propose: boolean;
  shiftDays: number | null; newStart: string | null; newEnd: string | null; workingHours: string | null; gapDays: number | null; firstRequestId: string | null;
};
export type Plan = {
  planKey: string; archetypes: Archetype[]; score: number; components: Record<Component, number>;
  confidence: { tier: "high" | "medium" | "low"; points: { code: string; points: number }[] };
  moves: Move[]; levers: Lever[];
  metrics: {
    riskBefore: number; riskAfter: number; riskReduction: number; focusCount: number; clearedFocus: number; newConflicts: number; worsened: number;
    totalShiftDays: number; perAgencyShiftDays: { agencyId: string; shiftDays: number }[]; agenciesToCoordinate: string[]; steps: number;
    daysToImpact: number | null; estimateDays: number; fitsBeforeStart: boolean | null; assumptionMoves: number; urgent: boolean;
  };
  approvals: { required: boolean; reasons: string[] };
  afterSummary: { riskIndex: number; maxBand: string | null; conflictCount: number };
  focusDiff: { pairKey: string; before: { score: number; band: string }; after: { score: number; band: string }; diff: "cleared" | "new" | "worsened" | "improved" | "unchanged" }[];
};
export type Excluded = { code: string; requestId: string | null; agencyId: string | null; mine: boolean; params: Record<string, number | string> };
export type Advice = {
  baseline: { riskIndex: number; maxBand: string | null; conflictCount: number };
  plans: Plan[]; excluded: Excluded[];
  coordination: { startNow: boolean; urgency: { daysToImpact: number | null; urgent: boolean }; suggestedLead: { agencyId: string; reasonCode: string | null } | null; participants: { agencyId: string; role: "required" | "consulted" }[]; reasons: string[] }[];
  opportunities: { sharedTrenchMeters: number | null; leadAgencyId: string | null; window: { start: string | null; end: string | null } }[];
  coverage: { truncated: boolean; evaluations: number; storedPairsOnly: true; pairsCapped: boolean; assumptions: number; flexibilityNotStored: true; focusPairs: number };
  inputsHash: string; advisorVersion: string;
};
export type AdviseOpts = { today: Date; national: boolean; clock?: () => number; trenchMeters?: number | null; maxEvaluations?: number };

type Candidate = { levers: Lever[]; moves: Move[]; ev: Evaluation; requestIds: string[] };

export function inputsHashOf(world: World): string {
  const reqs = [...world.requests.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, r]) => `${id}|${r.start?.toISOString() ?? ""}|${r.end?.toISOString() ?? ""}|${world.items.get(`work_request:${id}`)?.workingHours ?? ""}`);
  const pairs = world.docs.map((d) => String(d._id)).sort();
  return createHash("sha256").update([ADVISOR_VERSION, RULE_VERSION, String(world.rec._id), String(world.rec.version), world.rec.status, ...reqs, ...pairs].join("\n")).digest("hex").slice(0, 32);
}

export function advise(world: World, opts: AdviseOpts): Advice {
  const clock = opts.clock ?? (() => 0);
  const t0 = clock();
  const maxEval = opts.maxEvaluations ?? ADV.MAX_EVALUATIONS;
  const rec = world.rec;
  const base = evaluate(world, []);
  const empty = (truncated: boolean): Advice => ({ baseline: { riskIndex: 0, maxBand: null, conflictCount: 0 }, plans: [], excluded: [], coordination: [], opportunities: [], coverage: { truncated, evaluations: 0, storedPairsOnly: true, pairsCapped: world.capped, assumptions: 0, flexibilityNotStored: true, focusPairs: 0 }, inputsHash: inputsHashOf(world), advisorVersion: ADVISOR_VERSION });
  if (!base.ok) return empty(false);

  // 1. focus: live conflict pairs, highest score first.
  const focus = base.rows.filter((r) => live(r.before)).sort((a, b) => b.before.score - a.before.score || a.id.localeCompare(b.id)).slice(0, ADV.MAX_FOCUS_PAIRS);
  const focusIds = new Set(focus.map((r) => r.id));
  const riskBefore = base.result.request.before.riskIndex;
  const today = dayStartUtc(opts.today);
  const daysToImpact = rec.overlapWindow ? Math.ceil((dayStartUtc(new Date(rec.overlapWindow.start)) - today) / DAY) : null;
  const band = rec.severity.current.band;

  let evaluations = 0;
  let truncated = false;
  const excluded: Excluded[] = [];
  const outOfBudget = () => { if (evaluations >= maxEval || clock() - t0 > ADV.RUN_TIME_BUDGET_MS) { truncated = true; return true; } return false; };
  const run = (levers: Lever[]): Evaluation | null => { if (outOfBudget()) return null; evaluations += 1; const e = evaluate(world, levers); return e.ok ? e : null; };

  // Moves are described from the levers and the evaluation's own change list, so reported dates are exactly what was scored.
  const movesOf = (levers: Lever[], ev: Evaluation): Move[] => {
    const by = new Map(ev.changes.map((c) => [c.requestId, c]));
    const mk = (kind: Move["kind"], c: Change, extra: Partial<Move> = {}): Move => ({ kind, requestId: c.requestId, agencyId: c.agencyId, mine: world.mine(c.agencyId), propose: !world.mine(c.agencyId), shiftDays: c.shiftDays || null, newStart: c.start, newEnd: c.end, workingHours: c.workingHours, gapDays: null, firstRequestId: null, ...extra });
    const out: Move[] = [];
    for (const l of levers) {
      if (l.kind === "shift" || l.kind === "hours") { const c = by.get(l.requestId); if (c) out.push(mk(l.kind === "shift" ? "shift_request" : "set_hours", c)); }
      else if (l.kind === "buffer") {
        const second = ev.changes.find((c) => c.start);
        if (second) { const first = [...world.requests.keys()].find((id) => id !== second.requestId) ?? null; out.push(mk("sequence_pair", second, { gapDays: l.days, firstRequestId: first })); }
      }
    }
    return out.sort((a, b) => a.requestId.localeCompare(b.requestId) || a.kind.localeCompare(b.kind));
  };

  const ownEmergency = (id: string) => { const a = world.requests.get(id)?.agencyId; return Boolean(a && world.mine(a) && world.items.get(`work_request:${id}`)?.isEmergency); };

  // 2. single moves: shifts, hours, sequence gaps.
  const singles: Candidate[] = [];
  const reqIds = [...world.requests.keys()].sort();
  const pastNoted = new Set<string>();
  for (const id of reqIds) {
    const r = world.requests.get(id)!;
    if (!r.start || !r.end) continue;
    const dur = r.end.getTime() - r.start.getTime();
    for (const d of ADV.OFFSETS) {
      if (Math.abs(d) > ADV.SHIFT_LIMIT_DAYS) continue;
      const start = new Date(r.start.getTime() + d * DAY);
      if (dayStartUtc(start) < today && !ownEmergency(id)) {
        if (!pastNoted.has(id)) { pastNoted.add(id); excluded.push({ code: "start_in_past", requestId: id, agencyId: r.agencyId, mine: world.mine(r.agencyId), params: { shiftDays: d } }); }
        continue;
      }
      const levers: Lever[] = [{ kind: "shift", requestId: id, start: start.toISOString(), end: new Date(start.getTime() + dur).toISOString() }];
      const ev = run(levers);
      if (ev) singles.push({ levers, moves: movesOf(levers, ev), ev, requestIds: [id] });
    }
    const current = world.items.get(`work_request:${id}`)?.workingHours;
    for (const h of SIM_HOURS.filter((x) => x !== "24h" && x !== current)) {
      const levers: Lever[] = [{ kind: "hours", requestId: id, workingHours: h }];
      const ev = run(levers);
      if (ev) singles.push({ levers, moves: movesOf(levers, ev), ev, requestIds: [id] });
    }
  }
  for (const gap of ADV.SEQUENCE_GAPS) {
    const levers: Lever[] = [{ kind: "buffer", days: gap }];
    const ev = run(levers);
    if (ev && ev.changes.length) singles.push({ levers, moves: movesOf(levers, ev), ev, requestIds: ev.changes.map((c) => c.requestId) });
  }

  // 3. plan metrics + score (displayed formula; weights sum to 100).
  const hasOtherAgency = (moves: Move[]) => moves.filter((m) => m.propose).length;
  const planOf = (c: Candidate): Plan | null => {
    const rows = c.ev.rows;
    const focusRows = rows.filter((r) => focusIds.has(r.id));
    const cleared = focusRows.filter((r) => !live(r.after)).length;
    const newRows = rows.filter((r) => !live(r.before) && live(r.after));
    const worsenedRows = rows.filter((r) => live(r.before) && live(r.after) && BAND_ORDER.indexOf(r.after.band) > BAND_ORDER.indexOf(r.before.band));
    const riskAfter = c.ev.result.request.after.riskIndex;
    const reduction = riskBefore - riskAfter;
    const byAgency = new Map<string, number>();
    for (const ch of c.ev.changes) byAgency.set(ch.agencyId, (byAgency.get(ch.agencyId) ?? 0) + Math.abs(ch.shiftDays));
    const shifts = [...byAgency.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([agencyId, shiftDays]) => ({ agencyId, shiftDays }));
    const totalShift = shifts.reduce((n, s) => n + s.shiftDays, 0);
    const owners = new Set(c.ev.changes.map((x) => x.agencyId));
    const required = rec.affectedAgencies.filter((a) => a.required && a.active && !a.excluded).map((a) => a.agencyId);
    const coordinate = [...new Set([...owners, ...required])].sort();
    const reasons = nationalReasons({ type: "amendment", thirdParty: { newConflicts: newRows.length, worsened: worsenedRows.length, cleared: 0 }, severityAtDetection: rec.severity.atDetection.band, shiftDays: Math.max(0, ...c.ev.changes.map((x) => Math.abs(x.shiftDays))), band });
    const imbalance = shifts.length > 1 ? (100 * (Math.max(...shifts.map((s) => s.shiftDays)) - Math.min(...shifts.map((s) => s.shiftDays)))) / Math.max(1, totalShift) : 0;
    if (cleared === 0 && reduction <= 0) return null;
    const comps: Record<Component, number> = {
      riskReduction: clamp((100 * reduction) / Math.max(1, riskBefore)), clearance: focusRows.length ? clamp((100 * cleared) / focus.length) : 0,
      collateral: clamp(100 - Math.min(100, 25 * newRows.length + 15 * worsenedRows.length)), disruption: clamp(100 - Math.min(100, (100 * totalShift) / ADV.DISRUPTION_CAP_DAYS)),
      fairness: clamp(100 - imbalance), approvalBurden: reasons.length ? 50 : 100, coordinationEffort: clamp(100 - Math.min(100, 20 * (coordinate.length - 1))),
    };
    const components = Object.fromEntries((Object.keys(WEIGHTS) as Component[]).map((k) => [k, round1(comps[k])])) as Record<Component, number>;
    const score = round1((Object.keys(WEIGHTS) as Component[]).reduce((n, k) => n + (WEIGHTS[k] * comps[k]) / 100, 0));
    const steps = owners.size + (hasOtherAgency(c.moves) ? 1 : 0);
    const estimate = DEADLINE_DEFAULT_DAYS[band] + (reasons.length ? 2 * RES.APPROVAL_DUE_DAYS : RES.APPROVAL_DUE_DAYS) + 1;
    const points: { code: string; points: number }[] = [];
    const assumed = c.moves.filter((m) => m.propose).length;
    if (assumed) points.push({ code: "assumption_on_other_agency", points: -Math.min(CONF.ASSUMPTION_CAP, CONF.ASSUMPTION * assumed) });
    if (world.incompleteInputs) points.push({ code: "incomplete_inputs", points: -CONF.INCOMPLETE });
    if (world.capped) points.push({ code: "pairs_capped", points: -CONF.PAIRS_CAPPED });
    if (truncated) points.push({ code: "search_truncated", points: -CONF.TRUNCATED });
    if (world.ruleMismatch) points.push({ code: "rule_version_mismatch", points: -CONF.RULE_MISMATCH });
    const pts = 100 + points.reduce((n, p) => n + p.points, 0);
    const key = createHash("sha256").update(JSON.stringify(c.ev.changes.map((x) => [x.requestId, x.start, x.end, x.workingHours]))).digest("hex").slice(0, 12);
    return {
      planKey: key, archetypes: [], score, components, confidence: { tier: pts >= CONF.HIGH ? "high" : pts >= CONF.MEDIUM ? "medium" : "low", points },
      moves: c.moves, levers: c.levers,
      metrics: { riskBefore, riskAfter, riskReduction: reduction, focusCount: focus.length, clearedFocus: cleared, newConflicts: newRows.length, worsened: worsenedRows.length, totalShiftDays: totalShift, perAgencyShiftDays: shifts, agenciesToCoordinate: coordinate, steps, daysToImpact, estimateDays: estimate, fitsBeforeStart: daysToImpact === null ? null : estimate <= daysToImpact, assumptionMoves: assumed, urgent: daysToImpact !== null && daysToImpact <= ADV.URGENT_DAYS },
      approvals: { required: reasons.length > 0, reasons }, afterSummary: c.ev.result.request.after,
      focusDiff: focusRows.map((r) => ({ pairKey: r.id, before: { score: r.before.score, band: r.before.band }, after: { score: r.after.score, band: r.after.band }, diff: (!live(r.after) ? "cleared" : r.after.score < r.before.score ? "improved" : r.after.score > r.before.score ? "worsened" : "unchanged") as Plan["focusDiff"][number]["diff"] })),
    };
  };
  const hasNewHigh = (c: Candidate) => c.ev.rows.some((r) => !live(r.before) && live(r.after) && BAND_ORDER.indexOf(r.after.band) >= BAND_ORDER.indexOf("high"));
  const byRank = (a: Plan, b: Plan) => b.score - a.score || a.metrics.totalShiftDays - b.metrics.totalShiftDays || a.planKey.localeCompare(b.planKey);

  const scored: { c: Candidate; p: Plan }[] = [];
  const reject = (code: string, c: Candidate, p: Plan | null) => { const m = c.moves[0]; excluded.push({ code, requestId: m?.requestId ?? null, agencyId: m?.agencyId ?? null, mine: m ? m.mine : true, params: { riskReduction: p?.metrics.riskReduction ?? 0, shiftDays: p?.metrics.totalShiftDays ?? 0 } }); };
  const accept = (c: Candidate) => {
    const p = planOf(c);
    if (!p) { if (c.moves.length) reject("no_improvement", c, null); return; }
    if (hasNewHigh(c)) return void reject("creates_new_high_conflict", c, p);
    if (p.metrics.totalShiftDays > ADV.DISRUPTION_CAP_DAYS) return void reject("disruption_too_high", c, p);
    scored.push({ c, p });
  };
  singles.forEach(accept);

  // 4. beam: combine the best singles that touch DIFFERENT requests (never stack two moves on one request).
  const beam = [...scored].sort((a, b) => byRank(a.p, b.p)).slice(0, ADV.BEAM_WIDTH);
  for (let i = 0; i < beam.length; i += 1) {
    for (let j = i + 1; j < beam.length; j += 1) {
      const a = beam[i]!.c, b = beam[j]!.c;
      if (a.requestIds.some((x) => b.requestIds.includes(x))) continue;
      const levers = [...a.levers, ...b.levers];
      const ev = run(levers);
      if (ev) accept({ levers, moves: [...a.moves, ...b.moves].sort((x, y) => x.requestId.localeCompare(y.requestId)), ev, requestIds: [...a.requestIds, ...b.requestIds] });
    }
  }

  // 5. dedupe by effect, then archetypes over the whole scored set.
  const unique = new Map<string, Plan>();
  for (const { p } of [...scored].sort((a, b) => byRank(a.p, b.p))) if (!unique.has(p.planKey)) unique.set(p.planKey, p);
  const all = [...unique.values()].sort(byRank);
  const pick = (cmp: (a: Plan, b: Plan) => number, filter: (p: Plan) => boolean = () => true) => all.filter(filter).sort((a, b) => cmp(a, b) || byRank(a, b))[0];
  const tag = (p: Plan | undefined, a: Archetype) => { if (p && !p.archetypes.includes(a)) p.archetypes.push(a); };
  tag(pick((a, b) => (a.metrics.agenciesToCoordinate.length + a.metrics.steps) - (b.metrics.agenciesToCoordinate.length + b.metrics.steps) || b.metrics.riskReduction - a.metrics.riskReduction), "fastest");
  tag(pick((a, b) => a.metrics.totalShiftDays - b.metrics.totalShiftDays, (p) => p.metrics.clearedFocus >= 1), "leastDisruption");
  tag(pick((a, b) => b.metrics.riskReduction - a.metrics.riskReduction || a.metrics.totalShiftDays - b.metrics.totalShiftDays), "lowestRisk");
  tag(pick((a, b) => a.components.fairness - b.components.fairness === 0 ? b.metrics.riskReduction - a.metrics.riskReduction : b.components.fairness - a.components.fairness), "fairShare");
  const tagged = all.filter((p) => p.archetypes.length);
  const plans = [...tagged, ...all.filter((p) => !p.archetypes.length)].slice(0, ADV.MAX_PLANS).sort(byRank);

  // informational: the best plan that needs national approval when a lighter one exists.
  const natOnly = all.find((p) => p.approvals.required);
  if (natOnly && all.some((p) => !p.approvals.required) && !plans.includes(natOnly)) excluded.push({ code: "requires_national_approval_only_option", requestId: natOnly.moves[0]?.requestId ?? null, agencyId: natOnly.moves[0]?.agencyId ?? null, mine: natOnly.moves[0]?.mine ?? true, params: { riskReduction: natOnly.metrics.riskReduction } });
  const rank = (e: Excluded) => ["creates_new_high_conflict", "start_in_past", "disruption_too_high", "requires_national_approval_only_option", "no_improvement"].indexOf(e.code);
  const seen = new Set<string>();
  const whyNot = excluded.sort((a, b) => rank(a) - rank(b) || Number(b.params.riskReduction ?? 0) - Number(a.params.riskReduction ?? 0) || String(a.requestId).localeCompare(String(b.requestId)))
    .filter((e) => { const k = `${e.code}:${e.requestId}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, ADV.WHY_NOT_MAX);

  // 6. coordination and opportunity facts (non-scoring).
  const coordination: Advice["coordination"] = [];
  const noActive = !rec.coordination || rec.coordination.activeCount === 0;
  const resolutionActive = Boolean(rec.resolution && ["draft", "pending_approval", "approved", "applying", "verifying", "needs_followup"].includes(rec.resolution.state));
  const medium = BAND_CODES.indexOf(band) >= BAND_CODES.indexOf("medium");
  const ackOverdue = rec.affectedAgencies.some((a) => a.active && !a.excluded && a.ack.status === "pending" && a.ackDueAt && new Date(a.ackDueAt).getTime() < opts.today.getTime());
  const reasons = [...(daysToImpact !== null && daysToImpact <= ADV.COORDINATE_WITHIN_DAYS ? ["starts_soon"] : []), ...(ackOverdue ? ["ack_overdue"] : [])];
  if (OPEN_LIKE.includes(rec.status) && medium && noActive && !resolutionActive && reasons.length) {
    coordination.push({
      startNow: true, urgency: { daysToImpact, urgent: daysToImpact !== null && daysToImpact <= ADV.URGENT_DAYS }, suggestedLead: rec.lead ? { agencyId: rec.lead.agencyId, reasonCode: rec.lead.reasonCode } : null,
      participants: rec.affectedAgencies.filter((a) => a.active && !a.excluded).map((a) => ({ agencyId: a.agencyId, role: (a.required ? "required" : "consulted") as "required" | "consulted" })).sort((a, b) => a.agencyId.localeCompare(b.agencyId)), reasons,
    });
  }
  const opportunities: Advice["opportunities"] = rec.recordType === "opportunity" ? [{ sharedTrenchMeters: opts.trenchMeters ?? null, leadAgencyId: rec.lead?.agencyId ?? null, window: { start: rec.overlapWindow ? new Date(rec.overlapWindow.start).toISOString() : null, end: rec.overlapWindow ? new Date(rec.overlapWindow.end).toISOString() : null } }] : [];
  if (opportunities.length) tag(plans[0], "jointWorks");

  return {
    baseline: base.result.request.before, plans, excluded: whyNot, coordination, opportunities,
    coverage: { truncated, evaluations, storedPairsOnly: true, pairsCapped: world.capped, assumptions: plans.reduce((n, p) => n + p.metrics.assumptionMoves, 0), flexibilityNotStored: true, focusPairs: focus.length },
    inputsHash: inputsHashOf(world), advisorVersion: ADVISOR_VERSION,
  };
}
