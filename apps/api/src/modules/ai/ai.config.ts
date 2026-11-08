import { env } from "../../config/env.js";

/** Parsed AI processing settings. Absence of AI_BASE_URL/AI_INTERNAL_SECRET means "unavailable", never a boot failure. */

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}

export type AiConfig = Readonly<{
  baseUrl: string | undefined;
  secret: string | undefined;
  configured: boolean;
  processingEnabled: boolean;
  jobConcurrency: number;
  dailyTokenBudget: number;
  maxTokensPerDoc: number;
  embedModel: string | undefined;
  pricePerMTokensMinor: number | undefined;
  timeoutsMs: Readonly<{ health: number; extract: number; index: number; search: number; delete: number }>;
}>;

export function loadAiConfig(): AiConfig {
  const configured = Boolean(env.AI_BASE_URL && env.AI_INTERNAL_SECRET);
  const price = process.env.AI_EMBED_PRICE_PER_M_TOKENS_MINOR?.trim();
  return {
    baseUrl: env.AI_BASE_URL?.replace(/\/+$/, ""),
    secret: env.AI_INTERNAL_SECRET,
    configured,
    processingEnabled: bool("AI_PROCESSING_ENABLED", configured),
    jobConcurrency: int("AI_JOB_CONCURRENCY", 1, 1, 4),
    dailyTokenBudget: int("AI_EMBED_DAILY_TOKEN_BUDGET", 2_000_000, 1, 1_000_000_000),
    maxTokensPerDoc: int("AI_EMBED_MAX_TOKENS_PER_DOC", 600_000, 1, 10_000_000),
    embedModel: process.env.AI_EMBED_MODEL?.trim() || undefined,
    pricePerMTokensMinor: price && Number.isFinite(Number(price)) ? Number(price) : undefined,
    timeoutsMs: { health: 10_000, extract: 120_000, index: 120_000, search: 20_000, delete: 30_000 },
  };
}

export const aiConfig: AiConfig = loadAiConfig();
