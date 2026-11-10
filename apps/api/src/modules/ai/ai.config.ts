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

function num(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  return raw && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
}
function dec(name: string, fallback: number): number {
  const n = num(name);
  return n !== undefined && n >= 0 && n <= 1 ? n : fallback;
}

export type AiConfig = Readonly<{
  baseUrl: string | undefined;
  secret: string | undefined;
  secretPrevious: string | undefined;
  configured: boolean;
  processingEnabled: boolean;
  jobConcurrency: number;
  dailyTokenBudget: number;
  maxTokensPerDoc: number;
  embedModel: string | undefined;
  pricePerMTokensMinor: number | undefined;
  timeoutsMs: Readonly<{ health: number; extract: number; index: number; search: number; delete: number; answer: number; map: number; reduce: number; extractLlm: number; vision: number; copilotStep: number }>;
  chat: Readonly<{
    model: string | undefined; strongModel: string | undefined; dailyTokenBudget: number; qaMaxOutputTokens: number; summaryMaxInputTokens: number; redactContext: boolean; interactionTtlDays: number;
    /** US cents per million tokens, set only when verified against the provider catalog. */
    priceInputPerMMinor: number | undefined; priceOutputPerMMinor: number | undefined;
  }>;
  rag: Readonly<{ topK: number; contextChunks: number; contextMaxChars: number; minScore: number; perDocCap: number; requestsPer10Min: number }>;
  vision: Readonly<{
    model: string | undefined;
    maxBytes: number;
    dailyImageBudget: number;
    requestsPer10Min: number;
    pricePerImageMinor: number | undefined;
  }>;
  copilot: Readonly<{
    ttlDays: number;
    maxRounds: number;
    maxToolCalls: number;
    maxWallTimeS: number;
    toolTimeoutS: number;
    requestsPer10Min: number;
  }>;
}>;

export function loadAiConfig(): AiConfig {
  const configured = Boolean(env.AI_BASE_URL && env.AI_INTERNAL_SECRET);
  const price = process.env.AI_EMBED_PRICE_PER_M_TOKENS_MINOR?.trim();
  return {
    baseUrl: env.AI_BASE_URL?.replace(/\/+$/, ""),
    secret: env.AI_INTERNAL_SECRET,
    secretPrevious: env.AI_INTERNAL_SECRET_PREVIOUS,
    configured,
    processingEnabled: bool("AI_PROCESSING_ENABLED", configured),
    jobConcurrency: int("AI_JOB_CONCURRENCY", 1, 1, 4),
    dailyTokenBudget: int("AI_EMBED_DAILY_TOKEN_BUDGET", 2_000_000, 1, 1_000_000_000),
    maxTokensPerDoc: int("AI_EMBED_MAX_TOKENS_PER_DOC", 600_000, 1, 10_000_000),
    embedModel: process.env.AI_EMBED_MODEL?.trim() || undefined,
    pricePerMTokensMinor: price && Number.isFinite(Number(price)) ? Number(price) : undefined,
    timeoutsMs: { health: 10_000, extract: 120_000, index: 120_000, search: 20_000, delete: 30_000, answer: 60_000, map: 45_000, reduce: 60_000, extractLlm: 60_000, vision: 60_000, copilotStep: 45_000 },
    chat: {
      model: process.env.AI_CHAT_MODEL?.trim() || undefined, strongModel: process.env.AI_CHAT_MODEL_STRONG?.trim() || undefined,
      dailyTokenBudget: int("AI_CHAT_DAILY_TOKEN_BUDGET", 1_000_000, 1, 1_000_000_000), qaMaxOutputTokens: int("AI_QA_MAX_OUTPUT_TOKENS", 900, 100, 4000),
      summaryMaxInputTokens: int("AI_SUMMARY_MAX_INPUT_TOKENS", 200_000, 1000, 2_000_000), redactContext: bool("AI_REDACT_CONTEXT", true), interactionTtlDays: int("AI_INTERACTION_TTL_DAYS", 90, 1, 3650),
      priceInputPerMMinor: num("AI_CHAT_PRICE_INPUT_PER_M_MINOR"), priceOutputPerMMinor: num("AI_CHAT_PRICE_OUTPUT_PER_M_MINOR"),
    },
    rag: { topK: int("RAG_TOP_K", 24, 4, 50), contextChunks: int("RAG_CONTEXT_CHUNKS", 8, 1, 20), contextMaxChars: int("RAG_CONTEXT_MAX_CHARS", 12_000, 1000, 60_000), minScore: dec("RAG_MIN_SCORE", 0.4), perDocCap: int("RAG_PER_DOC_CAP", 4, 1, 10), requestsPer10Min: int("AI_REQUESTS_PER_10_MIN", 20, 1, 500) },
    vision: {
      model: process.env.AI_VISION_MODEL?.trim() || undefined,
      maxBytes: int("AI_VISION_MAX_BYTES", 6 * 1024 * 1024, 1024 * 1024, 30 * 1024 * 1024),
      dailyImageBudget: int("AI_VISION_DAILY_IMAGE_BUDGET", 100, 1, 100_000),
      requestsPer10Min: int("AI_VISION_REQUESTS_PER_10_MIN", 4, 1, 100),
      pricePerImageMinor: num("AI_VISION_PRICE_PER_IMAGE_MINOR"),
    },
    copilot: {
      ttlDays: int("AI_COPILOT_TTL_DAYS", 30, 1, 3650),
      maxRounds: int("AI_COPILOT_MAX_ROUNDS", 4, 1, 10),
      maxToolCalls: int("AI_COPILOT_MAX_TOOL_CALLS", 8, 1, 20),
      maxWallTimeS: int("AI_COPILOT_MAX_WALL_TIME_S", 45, 10, 120),
      toolTimeoutS: int("AI_COPILOT_TOOL_TIMEOUT_S", 8, 2, 30),
      requestsPer10Min: int("AI_COPILOT_REQUESTS_PER_10_MIN", 15, 1, 200),
    },
  };
}

export const aiConfig: AiConfig = loadAiConfig();
