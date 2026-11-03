import { useSyncExternalStore } from "react";

import type { Band } from "./assessment";
import type { Lever } from "./simulator";

/** Step 80 read models, exactly as the API sends them. Codes and numbers only; sentences are composed client-side. */
export type Archetype = "fastest" | "leastDisruption" | "lowestRisk" | "fairShare" | "jointWorks";
export const ARCHETYPES: Archetype[] = ["fastest", "leastDisruption", "lowestRisk", "fairShare", "jointWorks"];
export type Component = "riskReduction" | "clearance" | "collateral" | "disruption" | "fairness" | "approvalBurden" | "coordinationEffort";
export const COMPONENTS: Component[] = ["riskReduction", "clearance", "collateral", "disruption", "fairness", "approvalBurden", "coordinationEffort"];
export const WEIGHTS: Record<Component, number> = { riskReduction: 30, clearance: 20, collateral: 15, disruption: 15, fairness: 10, approvalBurden: 5, coordinationEffort: 5 };
export type Move = { kind: "shift_request" | "sequence_pair" | "set_hours"; requestId: string; agencyId: string; mine: boolean; propose: boolean; shiftDays: number | null; newStart: string | null; newEnd: string | null; workingHours: string | null; gapDays: number | null; firstRequestId: string | null };
export type Plan = {
  planKey: string; archetypes: Archetype[]; score: number; components: Record<Component, number>;
  confidence: { tier: "high" | "medium" | "low"; points: { code: string; points: number }[] };
  moves: Move[]; levers: Lever[];
  metrics: { riskBefore: number; riskAfter: number; riskReduction: number; focusCount: number; clearedFocus: number; newConflicts: number; collateralOther: number; worsened: number; totalShiftDays: number; perAgencyShiftDays: { agencyId: string; shiftDays: number }[]; agenciesToCoordinate: string[]; steps: number; daysToImpact: number | null; estimateDays: number; fitsBeforeStart: boolean | null; assumptionMoves: number; urgent: boolean };
  approvals: { required: boolean; reasons: string[] };
  afterSummary: { riskIndex: number; maxBand: Band | null; conflictCount: number };
  focusDiff: { pairKey: string; before: { score: number; band: Band }; after: { score: number; band: Band }; afterKind: string; diff: "cleared" | "new" | "worsened" | "improved" | "unchanged" }[];
};
export type Excluded = { code: string; requestId: string | null; agencyId: string | null; mine: boolean; params: Record<string, number | string> };
export type CoordinationFact = { startNow: boolean; urgency: { daysToImpact: number | null; urgent: boolean }; suggestedLead: { agencyId: string; reasonCode: string | null } | null; participants: { agencyId: string; role: "required" | "consulted" }[]; reasons: string[] };
export type Advice = {
  recNo: string | null; status: "fresh" | "terminal"; generatedAt: string; stale: false; cached: boolean; advisorVersion: string; audience: "national" | "agency";
  plans: Plan[]; excluded: Excluded[]; coordination: CoordinationFact[]; opportunities: { sharedTrenchMeters: number | null; leadAgencyId: string | null; window: { start: string | null; end: string | null } }[];
  coverage: { truncated: boolean; evaluations: number; storedPairsOnly: true; pairsCapped: boolean; assumptions: number; flexibilityNotStored: true; focusPairs: number };
  baseline: { riskIndex: number; maxBand: Band | null; conflictCount: number };
  dismissed: { planKey: string; reasonCode: string | null; at: string; score: number; archetypes: Archetype[] }[];
  confidence: "high" | "medium" | "low" | null; allowedActions: string[]; agencies: Record<string, string>; readOnly: boolean;
  requestPlan?: { planKey: string; requestId: string; shiftDays: number; fixes: number; of: number } | null; conflictId?: string;
};
export type HandoffTarget = "coordination" | "resolution" | "simulator";
export type Handoff = { target: HandoffTarget; drafts: ({ moveIndex: number; conflictId: string; type: string; proposal?: Record<string, unknown>; manual?: Record<string, unknown> })[]; notEligible: { moveIndex: number; reason: string }[]; levers?: Lever[]; banner: { recNo: string; planKey: string } };
export type Cached = { available: false } | { available: boolean; recNo: string; count: number; generatedAt: string; top: { planKey: string; archetype: Archetype | null; riskBefore: number; riskAfter: number } | null };
export type AdvisorStats = { generated: number; feedbackAgencies: number | null; suppressed: boolean; helpfulRate: number | null; dismissRate: number | null; handoffRate: number | null; dismissReasons: Record<string, number> | null };
export type DismissReason = "not_feasible" | "already_coordinated_offline" | "disagree_with_assessment" | "too_disruptive" | "other";
export const DISMISS_REASONS: DismissReason[] = ["not_feasible", "already_coordinated_offline", "disagree_with_assessment", "too_disruptive", "other"];
export type Preview = {
  current: { conflicts: number; maxBand: Band | null; riskIndex: number; candidates: { ref: string; agencyName: string | null; detailLevel: string; score: number; band: Band }[] };
  windows: { from: string; to: string; maxBand: Band | null; conflicts: number }[]; none: boolean;
  nearestClear: { earlier: { offsetDays: number; withinFlexibility: boolean } | null; later: { offsetDays: number; withinFlexibility: boolean } | null };
  bestForDisruption: { offsetDays: number; withinFlexibility: boolean } | null; agenciesToCoordinate: string[]; truncated: boolean; coverageNote: string; generatedAt: string;
};

// ---------- Priority Mixer: a pure, displayed formula over the returned component values (no network) ----------
export type Mix = { speed: number; disruption: number; risk: number; fairness: number };
export const MIX_KEYS = ["speed", "disruption", "risk", "fairness"] as const;
export const MIX_MAP: Record<keyof Mix, Partial<Record<Component, number>>> = {
  speed: { coordinationEffort: 0.6, approvalBurden: 0.4 }, disruption: { disruption: 0.7, collateral: 0.3 }, risk: { riskReduction: 0.6, clearance: 0.4 }, fairness: { fairness: 1 },
};
export const MIX_PRESETS: Record<"balanced" | "urgent" | "gentle" | "fair", Mix> = {
  balanced: { speed: 50, disruption: 50, risk: 50, fairness: 50 }, urgent: { speed: 90, disruption: 30, risk: 70, fairness: 20 },
  gentle: { speed: 30, disruption: 90, risk: 50, fairness: 40 }, fair: { speed: 30, disruption: 40, risk: 50, fairness: 90 },
};
export function mixedScore(plan: Plan, mix: Mix): number {
  const total = MIX_KEYS.reduce((n, k) => n + mix[k], 0);
  if (total === 0) return plan.score;
  const sum = MIX_KEYS.reduce((n, k) => n + mix[k] * Object.entries(MIX_MAP[k]).reduce((m, [c, w]) => m + (w ?? 0) * plan.components[c as Component], 0), 0);
  return Math.round((sum / total) * 10) / 10;
}
/** Re-ranks without hiding anything; ties fall back to the server order. */
export function rankByMix(plans: Plan[], mix: Mix | null): Plan[] {
  if (!mix) return plans;
  const idx = new Map(plans.map((p, i) => [p.planKey, i]));
  return [...plans].sort((a, b) => mixedScore(b, mix) - mixedScore(a, mix) || idx.get(a.planKey)! - idx.get(b.planKey)!);
}
/** Plans not dominated on (less disruption, more risk reduction). Sorted by disruption for the stepped line. */
export function paretoFrontier(plans: Plan[]): Plan[] {
  return plans.filter((p) => !plans.some((q) => q !== p && q.metrics.totalShiftDays <= p.metrics.totalShiftDays && q.metrics.riskReduction >= p.metrics.riskReduction && (q.metrics.totalShiftDays < p.metrics.totalShiftDays || q.metrics.riskReduction > p.metrics.riskReduction)))
    .sort((a, b) => a.metrics.totalShiftDays - b.metrics.totalShiftDays || b.metrics.riskReduction - a.metrics.riskReduction);
}

// ---------- handoff store: the payload is passed to the existing forms through sessionStorage (never persisted server-side) ----------
const HANDOFF_KEY = "infraos.advisor.handoff";
const listeners = new Set<() => void>();
export function stashHandoff(h: Handoff, conflictId: string) {
  try { window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...h, conflictId })); } catch { /* storage unavailable: the target form simply opens empty */ }
  listeners.forEach((l) => l());
}
export function clearHandoff() { try { window.sessionStorage.removeItem(HANDOFF_KEY); } catch { /* ignore */ } listeners.forEach((l) => l()); }
const readRaw = () => { try { return window.sessionStorage.getItem(HANDOFF_KEY); } catch { return null; } };
/** The stashed prefill for one target and conflict, or null. Server snapshot is null so hydration never mismatches. */
export function useHandoff(target: HandoffTarget, conflictId: string): Handoff | null {
  const raw = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, readRaw, () => null);
  if (!raw) return null;
  try { const h = JSON.parse(raw) as Handoff & { conflictId: string }; return h.target === target && h.conflictId === conflictId ? h : null; } catch { return null; }
}
