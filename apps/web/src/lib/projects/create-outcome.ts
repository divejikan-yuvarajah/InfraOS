import { ApiError } from "@/lib/api/client";

export type CreateFailure =
  | "invalid"
  | "duplicate"
  | "expired"
  | "denied"
  | "unavailable"
  | "limited"
  | "stale"
  | "unknown";

export function classifyCreateError(error: unknown): CreateFailure {
  if (error instanceof ApiError) {
    if (error.message === "session moved") return "stale";
    if (error.status === 409) return "duplicate";
    if (error.status === 401) return "expired";
    if (error.status === 403) return "denied";
    if (error.status === 400 || error.status === 415) return "invalid";
    if (error.status === 429) return "limited";
    if (error.status === 503) return "unavailable";
  }
  return "unknown";
}

export function shouldConfirmDiscard(dirty: boolean, saved: boolean): boolean {
  return dirty && !saved;
}
