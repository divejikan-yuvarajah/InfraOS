import type { Band } from "./assessment";

/** Step 79 read models, exactly as the API sends them. Scores, bands and counts only. */
export type Hours = "day" | "night" | "24h";
export const LEVER_KINDS = ["shift", "hours", "buffer", "sequence", "traffic", "cancel", "ghost", "replay"] as const;
export type LeverKind = (typeof LEVER_KINDS)[number];
export const MEASURES = ["flaggers", "night_work", "lane_staging", "detour_signage", "temporary_signals", "public_notice"] as const;
export const MAX_LEVERS = 8;
export const MAX_COMPARE = 4;

export type Lever =
  | { kind: "shift"; requestId: string; start: string; end: string }
  | { kind: "hours"; requestId: string; workingHours: Hours }
  | { kind: "buffer"; days: number }
  | { kind: "sequence"; firstRequestId: string; secondRequestId: string; gapDays: number }
  | { kind: "traffic"; requestId: string; measures: string[] }
  | { kind: "cancel"; requestId: string }
  | { kind: "ghost"; sourceRequestId: string; start: string; end: string; workingHours?: Hours }
  | { kind: "replay"; coordinationRequestId: string };
/** A lever plus a stable client key for list rendering; the key is never sent. */
export type DraftLever = { key: string; lever: Lever };

export type Snap = { score: number; band: Band; kind: string };
export type SimResult = {
  pair: { before: Snap; after: Snap };
  request: { before: { riskIndex: number; maxBand: Band | null; conflictCount: number }; after: { riskIndex: number; maxBand: Band | null; conflictCount: number } };
  thirdParty: { newConflicts: number; worsened: number; cleared: number };
  ghost: { pairs: number; newConflicts: number; maxBand: Band | null } | null;
  verdict: "clears" | "lowers" | "none" | "raises";
  levers: { kind: string; assumption: boolean; scoreEffect: "applied" | "none" | "removed" }[];
  commitments: { requestId: string; measures: string[] }[];
  warnings: string[]; actionable: boolean; coverageNote: "stored_pairs_only";
};
export type Visibility = "private" | "agency" | "national";
export type SavedScenario = { id: string; name: string; visibility: Visibility; mine: boolean; createdAt: string; levers: Lever[]; result: SimResult };
export type Run = { id: string; label: string; levers: Lever[]; result: SimResult };

let seq = 0;
export const newKey = () => `l${(seq += 1)}`;
export function defaultLever(kind: LeverKind, ctx: { first: string; second: string; replayId: string }): Lever {
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  switch (kind) {
    case "shift": return { kind, requestId: ctx.first, start: day(30), end: day(40) };
    case "hours": return { kind, requestId: ctx.first, workingHours: "night" };
    case "buffer": return { kind, days: 3 };
    case "sequence": return { kind, firstRequestId: ctx.first, secondRequestId: ctx.second, gapDays: 2 };
    case "traffic": return { kind, requestId: ctx.first, measures: ["flaggers"] };
    case "cancel": return { kind, requestId: ctx.first };
    case "ghost": return { kind, sourceRequestId: ctx.first, start: day(30), end: day(40) };
    case "replay": return { kind, coordinationRequestId: ctx.replayId };
  }
}
export const leverTarget = (l: Lever): string | null => ("requestId" in l ? l.requestId : "sourceRequestId" in l ? l.sourceRequestId : null);
export const deltaScore = (r: SimResult) => r.pair.after.score - r.pair.before.score;
