import type { ApiFailure } from "@infraos/shared-types";

import { isSafeFieldPath } from "./normalizers";

export type MappedFormErrors = {
  fieldErrors: Array<{ path: string; message: string }>;
  formMessage?: string;
  requestId?: string;
};

function readFieldErrors(details: unknown): Record<string, string> {
  if (!details || typeof details !== "object") return {};
  const record = details as { fieldErrors?: unknown };
  if (!record.fieldErrors || typeof record.fieldErrors !== "object") return {};
  const entries = Object.entries(record.fieldErrors as Record<string, unknown>);
  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim()) result[key] = value;
  }
  return result;
}

function generalMessage(failure: ApiFailure): string {
  switch (failure.error.code) {
    case "AUTH_REQUIRED":
    case "SESSION_EXPIRED":
      return "Sign in is required before this action can continue.";
    case "FORBIDDEN":
    case "INSUFFICIENT_PERMISSION":
    case "RESOURCE_SCOPE_DENIED":
    case "RESOURCE_NOT_ASSIGNED":
      return "You do not have permission to complete this action.";
    case "RESOURCE_NOT_FOUND":
      return "The requested record is not available.";
    case "CONFLICT_DETECTED":
    case "DUPLICATE_RESOURCE":
    case "INVALID_STATE_TRANSITION":
      return "This record changed or conflicts with existing work. Review and try again.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait and try again later.";
    case "INTERNAL_ERROR":
    case "SERVICE_UNAVAILABLE":
    case "NOT_READY":
      return "The service could not complete the request. Try again later.";
    default:
      return failure.error.message || "The request could not be completed.";
  }
}

/**
 * Map a Step 16 API failure into RHF field errors.
 * Unknown or unsafe paths stay on the form summary.
 */
export function mapApiFailureToFormErrors(
  failure: ApiFailure,
  allowedPaths: readonly string[],
): MappedFormErrors {
  const allowed = new Set(allowedPaths);
  const fieldErrors: Array<{ path: string; message: string }> = [];
  const unknown: string[] = [];

  if (failure.error.code === "VALIDATION_ERROR") {
    for (const [path, message] of Object.entries(readFieldErrors(failure.error.details))) {
      if (isSafeFieldPath(path, allowed)) {
        fieldErrors.push({ path, message });
      } else {
        unknown.push(message);
      }
    }
  }

  const formMessage =
    unknown.length > 0
      ? unknown.join(" ")
      : fieldErrors.length === 0
        ? generalMessage(failure)
        : undefined;

  return {
    fieldErrors,
    formMessage,
    requestId: failure.meta?.requestId,
  };
}
