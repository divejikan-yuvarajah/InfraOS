import type { AiFeatureKey } from "@infraos/shared-types";

export type AiFallbackType =
  | "QUICK_FACTS"
  | "PASSAGES_ONLY"
  | "MANUAL_INSPECTION"
  | "RETRY_LATER"
  | "DOC_SEARCH"
  | "NONE";

export type UserSafeAiFailure = {
  code: string;
  userMessageKey: string;
  userMessage: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  resetsAt?: Date;
  fallbackType: AiFallbackType;
  scope?: "USER" | "AGENCY" | "PLATFORM" | "FEATURE";
};

export function mapAiFailure(
  rawCode: string,
  opts?: {
    feature?: AiFeatureKey;
    scope?: "USER" | "AGENCY" | "PLATFORM" | "FEATURE";
    retryAfterSeconds?: number;
    resetsAt?: Date;
    details?: any;
  },
): UserSafeAiFailure {
  const code = (rawCode || "").toUpperCase();
  const feature = opts?.feature;

  // 1. Feature disabled by administrator
  if (code === "FEATURE_DISABLED" || code === "DISABLED") {
    return {
      code: "FEATURE_DISABLED",
      userMessageKey: "ai.failure.featureDisabled",
      userMessage: "This AI feature is turned off by your administrator.",
      retryable: false,
      fallbackType: feature === "copilot" ? "QUICK_FACTS" : "NONE",
      scope: opts?.scope ?? "FEATURE",
    };
  }

  // 2. Model not configured
  if (code === "MODEL_NOT_CONFIGURED" || code === "NOT_CONFIGURED") {
    return {
      code: "MODEL_NOT_CONFIGURED",
      userMessageKey: "ai.failure.modelNotConfigured",
      userMessage: "AI model for this feature is not configured in settings.",
      retryable: false,
      fallbackType: feature === "copilot" ? "QUICK_FACTS" : feature === "vision" ? "MANUAL_INSPECTION" : "NONE",
      scope: "PLATFORM",
    };
  }

  // 3. Rate limiting (fixed-window user or agency limits)
  if (code === "AI_RATE_LIMITED" || code === "RATE_LIMITED" || code === "LLM_RATE_LIMITED") {
    const retryAfter = opts?.retryAfterSeconds ?? 60;
    return {
      code: "AI_RATE_LIMITED",
      userMessageKey: "ai.failure.rateLimited",
      userMessage: `Rate limit reached. Try again in ${retryAfter} seconds.`,
      retryable: true,
      retryAfterSeconds: retryAfter,
      fallbackType: feature === "copilot" ? "QUICK_FACTS" : "RETRY_LATER",
      scope: opts?.scope ?? "USER",
    };
  }

  // 4. Concurrency exceeded
  if (code === "AI_CONCURRENCY_EXCEEDED") {
    return {
      code: "AI_CONCURRENCY_EXCEEDED",
      userMessageKey: "ai.failure.concurrencyExceeded",
      userMessage: "Another AI operation is already running for your account. Please wait for it to finish.",
      retryable: true,
      retryAfterSeconds: 5,
      fallbackType: "NONE",
      scope: "USER",
    };
  }

  // 5. Daily or monthly budget exceeded
  if (code === "AI_BUDGET_EXCEEDED" || code === "BUDGET_EXCEEDED") {
    return {
      code: "AI_BUDGET_EXCEEDED",
      userMessageKey: "ai.failure.budgetExceeded",
      userMessage: "Daily AI usage budget has been reached for your agency. Quotas reset at midnight.",
      retryable: false,
      resetsAt: opts?.resetsAt,
      fallbackType: feature === "copilot" ? "QUICK_FACTS" : feature === "qa" ? "PASSAGES_ONLY" : "NONE",
      scope: opts?.scope ?? "AGENCY",
    };
  }

  // 6. Timeouts
  if (code === "AI_SERVICE_TIMEOUT" || code === "LLM_TIMEOUT" || code === "TIMEOUT") {
    return {
      code: "AI_SERVICE_TIMEOUT",
      userMessageKey: "ai.failure.timeout",
      userMessage: "AI request timed out. You may retry your request.",
      retryable: true,
      fallbackType: feature === "copilot" ? "QUICK_FACTS" : "RETRY_LATER",
      scope: "PLATFORM",
    };
  }

  // 7. Context length exceeded / payload too large
  if (code === "TOO_LARGE" || code === "LLM_CONTEXT_TOO_LONG" || code === "AI_TOO_LARGE") {
    return {
      code: "AI_TOO_LARGE",
      userMessageKey: "ai.failure.contextTooLarge",
      userMessage: "The input context is too large for the model. Try asking a more specific question.",
      retryable: false,
      fallbackType: "NONE",
      scope: "USER",
    };
  }

  // 8. Document readiness / missing embeddings
  if (code === "NOT_AI_READY" || code === "AI_NOT_READY") {
    return {
      code: "NOT_AI_READY",
      userMessageKey: "ai.failure.notReady",
      userMessage: "Document is still being processed or is not ready for AI queries.",
      retryable: true,
      fallbackType: "DOC_SEARCH",
      scope: "USER",
    };
  }

  // 9. Insufficient evidence
  if (code === "AI_INSUFFICIENT_EVIDENCE" || code === "INSUFFICIENT_EVIDENCE") {
    return {
      code: "AI_INSUFFICIENT_EVIDENCE",
      userMessageKey: "ai.failure.insufficientEvidence",
      userMessage: "No sufficiently grounded evidence was found to answer this query safely.",
      retryable: false,
      fallbackType: feature === "qa" ? "PASSAGES_ONLY" : "NONE",
      scope: "USER",
    };
  }

  // 10. Service unavailable / circuit breaker open
  if (
    code === "AI_SERVICE_UNAVAILABLE" ||
    code === "AI_UNAVAILABLE" ||
    code === "LLM_UNAVAILABLE" ||
    code === "CIRCUIT_OPEN"
  ) {
    let fallback: AiFallbackType = "RETRY_LATER";
    if (feature === "copilot") fallback = "QUICK_FACTS";
    else if (feature === "qa") fallback = "PASSAGES_ONLY";
    else if (feature === "vision") fallback = "MANUAL_INSPECTION";

    return {
      code: "AI_UNAVAILABLE",
      userMessageKey: "ai.failure.serviceUnavailable",
      userMessage: "AI services are temporarily unavailable. Standard operations remain fully functional.",
      retryable: true,
      retryAfterSeconds: 30,
      fallbackType: fallback,
      scope: "PLATFORM",
    };
  }

  // 11. Invalid model output
  if (code === "LLM_INVALID_OUTPUT" || code === "AI_INVALID_OUTPUT") {
    return {
      code: "AI_INVALID_OUTPUT",
      userMessageKey: "ai.failure.invalidOutput",
      userMessage: "The AI response failed validation checks and was rejected for safety.",
      retryable: true,
      fallbackType: feature === "copilot" ? "QUICK_FACTS" : "RETRY_LATER",
      scope: "PLATFORM",
    };
  }

  // Generic fallback
  return {
    code: code || "AI_ERROR",
    userMessageKey: "ai.failure.generic",
    userMessage: "An AI processing error occurred. Non-AI workflows are unaffected.",
    retryable: true,
    fallbackType: feature === "copilot" ? "QUICK_FACTS" : "NONE",
    scope: opts?.scope ?? "PLATFORM",
  };
}

