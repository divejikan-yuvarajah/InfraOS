import { ApiError } from "@/lib/api/client";

export type EditFailure =
  | "invalid"
  | "conflict"
  | "expired"
  | "denied"
  | "notFound"
  | "unavailable"
  | "limited"
  | "stale"
  | "unknown";

export function classifyEditError(error: unknown): EditFailure {
  if (error instanceof ApiError) {
    if (error.message === "session moved") return "stale";
    if (error.status === 409) return "conflict";
    if (error.status === 401) return "expired";
    if (error.status === 403) return "denied";
    if (error.status === 404) return "notFound";
    if (error.status === 400 || error.status === 415) return "invalid";
    if (error.status === 429) return "limited";
    if (error.status === 503) return "unavailable";
  }
  return "unknown";
}
