import { aiConfig } from "../ai.config.js";
import { AiUsageRecord } from "../usage.model.js";

/** Asia/Colombo is a fixed UTC+05:30 offset (no DST), so day boundaries are simple arithmetic. */
const COLOMBO_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

export function colomboDayStart(now: Date): Date {
  const local = now.getTime() + COLOMBO_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - COLOMBO_OFFSET_MS);
}
export const nextColomboMidnight = (now: Date): Date => new Date(colomboDayStart(now).getTime() + DAY_MS);

export type BudgetState = { used: number; budget: number; remaining: number; exceeded: boolean; resetsAt: Date };

export async function tokensUsedToday(now = new Date(), kind: "EMBEDDING" | "CHAT" | "VISION" = "EMBEDDING"): Promise<number> {
  const rows = await AiUsageRecord.aggregate<{ total: number }>([
    { $match: { kind, createdAt: { $gte: colomboDayStart(now) }, status: "OK" } },
    { $group: { _id: null, total: { $sum: { $add: ["$inputTokens", "$outputTokens"] } } } },
  ]);
  return rows[0]?.total ?? 0;
}

/** Checked before a job starts. `pendingEstimate` (the job's own token estimate) is included so one job cannot blow far past the budget. */
export async function budgetState(now = new Date(), pendingEstimate = 0, budget = aiConfig.dailyTokenBudget): Promise<BudgetState> {
  const used = await tokensUsedToday(now);
  return { used, budget, remaining: Math.max(0, budget - used), exceeded: used + pendingEstimate > budget, resetsAt: nextColomboMidnight(now) };
}
