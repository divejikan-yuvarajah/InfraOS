import type {
  ConflictSeverity,
  ConflictStatus,
  ProjectStatus,
  WorkStatus,
} from "@infraos/shared-types";

/**
 * Visual-only categories for UI styling. Does NOT grant permissions or change API state.
 * Pair every status color with text and/or icon (Step 17).
 */
export type StatusVisualCategory =
  | "neutral"
  | "pending"
  | "warning"
  | "critical"
  | "success"
  | "info"
  | "selected";

export type StatusBadgeVariant =
  | "neutral"
  | "pending"
  | "warning"
  | "critical"
  | "success"
  | "info";

/** Maps Step 16 project statuses to badge/status token variants. */
export function projectStatusVisual(status: ProjectStatus): StatusBadgeVariant {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "pending";
    case "REJECTED":
      return "critical";
    case "ON_HOLD":
    case "DELAYED":
      return "warning";
    case "APPROVED":
    case "ACTIVE":
      return "success";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "critical";
    default:
      return "neutral";
  }
}

export function workStatusVisual(status: WorkStatus): StatusBadgeVariant {
  switch (status) {
    case "DRAFT":
    case "SUBMITTED":
      return "pending";
    case "PLANNED":
      return "info";
    case "APPROVED":
    case "ACTIVE":
      return "success";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "critical";
    default:
      return "neutral";
  }
}

export function conflictStatusVisual(status: ConflictStatus): StatusBadgeVariant {
  switch (status) {
    case "OPEN":
    case "COORDINATION_PENDING":
    case "UNDER_REVIEW":
      return "warning";
    case "RESOLVED":
    case "CLOSED":
      return "success";
    case "DISMISSED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function conflictSeverityVisual(
  severity: ConflictSeverity,
): StatusBadgeVariant {
  switch (severity) {
    case "LOW":
      return "info";
    case "MEDIUM":
      return "warning";
    case "HIGH":
    case "CRITICAL":
      return "critical";
    default:
      return "neutral";
  }
}
