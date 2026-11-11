import { logger } from "../../../shared/logger.js";

/**
 * Typed safe logging payload for all AI modules.
 * Deliberately excludes prompt text, user messages, answers, raw tool outputs, or base64 images.
 */
export type SafeAiLogFields = {
  event: string;
  requestId?: string;
  userId?: string;
  agencyId?: string;
  feature?: string;
  tier?: string;
  model?: string;
  status?: string;
  errorCode?: string;
  turnId?: string;
  analysisId?: string;
  documentId?: string;
  inputTokens?: number;
  outputTokens?: number;
  imagesCount?: number;
  durationMs?: number;
  latencyMs?: number;
  count?: number;
  droppedCount?: number;
};

export const aiLogger = {
  info(fields: SafeAiLogFields, msg?: string): void {
    logger.info(fields, msg || fields.event);
  },
  warn(fields: SafeAiLogFields, msg?: string): void {
    logger.warn(fields, msg || fields.event);
  },
  error(fields: SafeAiLogFields, msg?: string): void {
    logger.error(fields, msg || fields.event);
  },
};
