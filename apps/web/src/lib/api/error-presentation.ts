import type { ApiFailure } from "@infraos/shared-types";

import { ApiError } from "./errors";

export type FeedbackErrorKind =
  | "network"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "rate-limit"
  | "server"
  | "validation-delegate"
  | "unknown";

export type FeedbackPresentation = {
  kind: FeedbackErrorKind;
  title: string;
  description?: string;
  showRetry: boolean;
  requestId?: string;
};

function safeRequestId(meta: { requestId?: string } | undefined): string | undefined {
  const id = meta?.requestId?.trim();
  if (!id || id.length > 64) return undefined;
  if (/[\s<>]/.test(id)) return undefined;
  return id;
}

function fromErrorCode(code: string): Omit<FeedbackPresentation, "requestId"> {
  switch (code) {
    case "AUTH_REQUIRED":
    case "SESSION_EXPIRED":
      return {
        kind: "unauthenticated",
        title: "Sign in required",
        description: "Sign in is required before this view can load.",
        showRetry: false,
      };
    case "FORBIDDEN":
    case "INSUFFICIENT_PERMISSION":
    case "RESOURCE_SCOPE_DENIED":
    case "RESOURCE_NOT_ASSIGNED":
      return {
        kind: "forbidden",
        title: "Access not available",
        description: "You do not have permission to view this content.",
        showRetry: false,
      };
    case "RESOURCE_NOT_FOUND":
      return {
        kind: "not-found",
        title: "Record not available",
        description: "The requested record could not be found or is no longer available.",
        showRetry: false,
      };
    case "CONFLICT_DETECTED":
    case "DUPLICATE_RESOURCE":
    case "INVALID_STATE_TRANSITION":
      return {
        kind: "conflict",
        title: "Update conflict",
        description: "This record changed or conflicts with existing work. Review and try again.",
        showRetry: true,
      };
    case "RATE_LIMITED":
      return {
        kind: "rate-limit",
        title: "Too many requests",
        description: "Wait a moment and try again.",
        showRetry: true,
      };
    case "VALIDATION_ERROR":
      return {
        kind: "validation-delegate",
        title: "Check the form",
        description: "Correct the highlighted fields and try again.",
        showRetry: false,
      };
    case "INTERNAL_ERROR":
    case "SERVICE_UNAVAILABLE":
    case "NOT_READY":
      return {
        kind: "server",
        title: "Service unavailable",
        description: "The service could not complete the request. Try again later.",
        showRetry: true,
      };
    default:
      return {
        kind: "unknown",
        title: "Something went wrong",
        description: "The request could not be completed.",
        showRetry: true,
      };
  }
}

/** Map Step 16 `ApiFailure` to safe UI copy. Never surfaces raw server messages. */
export function presentApiFailure(failure: ApiFailure): FeedbackPresentation {
  const base = fromErrorCode(failure.error.code);
  return { ...base, requestId: safeRequestId(failure.meta) };
}

/** Map transport-level `ApiError` (fetch client) to safe UI copy. */
export function presentApiError(error: ApiError): FeedbackPresentation {
  if (error.status === 401) {
    return fromErrorCode("AUTH_REQUIRED");
  }
  if (error.status === 403) {
    return fromErrorCode("FORBIDDEN");
  }
  if (error.status === 404) {
    return fromErrorCode("RESOURCE_NOT_FOUND");
  }
  if (error.status === 409) {
    return fromErrorCode("CONFLICT_DETECTED");
  }
  if (error.status === 429) {
    return fromErrorCode("RATE_LIMITED");
  }
  if (error.status >= 500) {
    return fromErrorCode("INTERNAL_ERROR");
  }
  if (error.status === 400 || error.status === 422) {
    return fromErrorCode(error.code === "VALIDATION_ERROR" ? "VALIDATION_ERROR" : "unknown");
  }
  if (error.code) {
    return fromErrorCode(error.code);
  }
  return fromErrorCode("unknown");
}

/** Map unknown thrown values (network/offline) to safe UI copy. */
export function presentUnknownError(error: unknown): FeedbackPresentation {
  if (error instanceof ApiError) {
    return presentApiError(error);
  }
  if (error instanceof TypeError) {
    return {
      kind: "network",
      title: "Connection problem",
      description: "Check your network connection and try again.",
      showRetry: true,
    };
  }
  return fromErrorCode("unknown");
}
