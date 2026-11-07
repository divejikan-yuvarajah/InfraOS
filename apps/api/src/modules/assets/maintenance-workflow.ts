import type { MaintenanceStatus, OperationalStatus } from "./asset.constants.js";

/** Pure maintenance workflow: one transition table, derived overdue, recurrence, status coupling and the repeat-failure flag. */
export type MaintenanceAction = "APPROVE" | "REJECT" | "SCHEDULE" | "START" | "COMPLETE" | "CANCEL" | "EDIT";

export const MAINT_TRANSITIONS: Record<MaintenanceAction, { from: readonly MaintenanceStatus[]; to: MaintenanceStatus | null }> = {
  APPROVE: { from: ["REQUESTED"], to: "PLANNED" },
  REJECT: { from: ["REQUESTED"], to: "REJECTED" },
  // Setting the date or team of a planned job moves it to SCHEDULED; re-scheduling a scheduled job keeps it there.
  SCHEDULE: { from: ["PLANNED", "SCHEDULED"], to: "SCHEDULED" },
  START: { from: ["SCHEDULED"], to: "IN_PROGRESS" },
  COMPLETE: { from: ["IN_PROGRESS"], to: "COMPLETED" },
  CANCEL: { from: ["PLANNED", "SCHEDULED", "IN_PROGRESS"], to: "CANCELLED" },
  EDIT: { from: ["REQUESTED", "PLANNED", "SCHEDULED"], to: null },
};
export const canMaintTransition = (a: MaintenanceAction, s: MaintenanceStatus): boolean => MAINT_TRANSITIONS[a].from.includes(s);
export const OPEN_STATUSES: readonly MaintenanceStatus[] = ["REQUESTED", "PLANNED", "SCHEDULED", "IN_PROGRESS"];
export const TERMINAL_MAINT: readonly MaintenanceStatus[] = ["COMPLETED", "CANCELLED", "REJECTED"];
export const isOpenMaintenance = (s: MaintenanceStatus): boolean => OPEN_STATUSES.includes(s);

/** Overdue is derived, never stored: work that is planned, scheduled or in progress and past its scheduled date. */
export const isMaintenanceOverdue = (status: MaintenanceStatus, scheduledDate: Date, now = new Date()): boolean =>
  (status === "PLANNED" || status === "SCHEDULED" || status === "IN_PROGRESS") && scheduledDate.getTime() < now.getTime();

export const daysBetween = (a: Date, b: Date): number => Math.floor((b.getTime() - a.getTime()) / 86_400_000);
export const nextRecurrenceDate = (completed: Date, recurrenceDays: number): Date => new Date(completed.getTime() + recurrenceDays * 86_400_000);

/** Approver must differ from the requester. The single exception: an EMERGENCY job approved by a GOV_ADMIN who acknowledged it. */
export function approvalAllowed(args: { actorId: string; requesterId: string | null; maintenanceType: string; roleKey: string; acknowledgeEmergency?: boolean }): { ok: boolean; viaEmergency: boolean } {
  if (!args.requesterId || args.actorId !== args.requesterId) return { ok: true, viaEmergency: false };
  if (args.maintenanceType === "EMERGENCY" && args.roleKey === "GOV_ADMIN" && args.acknowledgeEmergency === true) return { ok: true, viaEmergency: true };
  return { ok: false, viaEmergency: false };
}

/**
 * Operational status coupling. Only IN_SERVICE and UNDER_MAINTENANCE are ever flipped automatically;
 * OUT_OF_SERVICE and DECOMMISSIONED are manual decisions and are never overridden.
 */
export function coupledStatus(current: OperationalStatus, inProgressCount: number): OperationalStatus {
  if (current === "OUT_OF_SERVICE" || current === "DECOMMISSIONED") return current;
  return inProgressCount > 0 ? "UNDER_MAINTENANCE" : "IN_SERVICE";
}

/** Three or more corrective or emergency jobs within twelve months (cancelled and rejected ones do not count). */
export function repeatFailures(records: { maintenanceType: string; status: MaintenanceStatus; scheduledDate: Date }[], now = new Date()): { flagged: boolean; count: number } {
  const since = now.getTime() - 365 * 86_400_000;
  const count = records.filter((r) => (r.maintenanceType === "CORRECTIVE" || r.maintenanceType === "EMERGENCY") && r.status !== "CANCELLED" && r.status !== "REJECTED" && r.scheduledDate.getTime() >= since).length;
  return { flagged: count >= 3, count };
}

/** Task reconciliation at completion: every task must be done, or skipped with a note. */
export const unresolvedTasks = (tasks: { key: string; done: boolean; skippedNote?: string | null }[]): string[] => tasks.filter((t) => !t.done && !t.skippedNote?.trim()).map((t) => t.key);
