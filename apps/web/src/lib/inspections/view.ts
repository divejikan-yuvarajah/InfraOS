import type { AuthLocale } from "@/lib/auth/types";

import { DISCREPANCY_THRESHOLD_PP, PROGRESS_TYPES, type InspectionType, type Report } from "./types";

export const fill = (template: string, vars: Record<string, string | number> = {}): string => template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

const INTL: Record<AuthLocale, string> = { en: "en-LK", si: "si-LK", ta: "ta-LK" };
export const intlLocale = (l: AuthLocale): string => INTL[l] ?? "en-LK";
const TZ = "Asia/Colombo";

export const fmtDate = (iso: string | null | undefined, l: AuthLocale): string => (iso ? new Intl.DateTimeFormat(intlLocale(l), { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—");
export const fmtTime = (iso: string | null | undefined, l: AuthLocale): string => (iso ? new Intl.DateTimeFormat(intlLocale(l), { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "—");
export const fmtDateTime = (iso: string | null | undefined, l: AuthLocale): string => (iso ? `${fmtDate(iso, l)} ${fmtTime(iso, l)}` : "—");
export const fmtMonth = (d: Date, l: AuthLocale): string => new Intl.DateTimeFormat(intlLocale(l), { timeZone: TZ, month: "long", year: "numeric" }).format(d);
export const fmtDayLong = (d: Date, l: AuthLocale): string => new Intl.DateTimeFormat(intlLocale(l), { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
export const weekdayShort = (l: AuthLocale): string[] => {
  const f = new Intl.DateTimeFormat(intlLocale(l), { timeZone: "UTC", weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 2024-01-01 is a Monday
};
export const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export const isProgressType = (t: InspectionType): boolean => PROGRESS_TYPES.includes(t);
export const discrepancy = (measured: number | null | undefined, claimed: number | null | undefined): number | null =>
  measured === null || measured === undefined || claimed === null || claimed === undefined ? null : Math.round(measured) - Math.round(claimed);
export const overThreshold = (measured: number | null | undefined, claimed: number | null | undefined): boolean => { const d = discrepancy(measured, claimed); return d !== null && Math.abs(d) > DISCREPANCY_THRESHOLD_PP; };

export type Gap = "checklist_incomplete" | "fail_without_note" | "not_enough_evidence" | "fail_item_without_photo" | "critical_defect_without_photo" | "measured_progress_required" | "discrepancy_note_required" | "declaration_required" | "evidence_uploading";
export type GapStep = "checklist" | "evidence" | "progress" | "submit";
export const GAP_STEP: Record<Gap, GapStep> = {
  checklist_incomplete: "checklist", fail_without_note: "checklist", fail_item_without_photo: "evidence", critical_defect_without_photo: "evidence", not_enough_evidence: "evidence",
  measured_progress_required: "progress", discrepancy_note_required: "progress", declaration_required: "submit", evidence_uploading: "evidence",
};

/** Mirror of the server rule so the editor can show what is still missing. The server remains the authority and re-checks on submit. */
export function clientGaps(args: { type: InspectionType; template: { key: string; mandatory: boolean }[]; report: Report; evidence: { checklistItemKey: string | null; defectKey: string | null; status: string }[]; claimed: number | null }): Gap[] {
  const { type, template, report, claimed } = args;
  const active = args.evidence.filter((e) => e.status === "ACTIVE");
  const gaps = new Set<Gap>();
  const answers = new Map(report.checklist.map((c) => [c.key, c]));
  for (const item of template) { const a = answers.get(item.key); if (item.mandatory && (!a || a.result === "NOT_CHECKED")) gaps.add("checklist_incomplete"); }
  for (const a of report.checklist) if (a.result === "FAIL") { if (!a.note?.trim()) gaps.add("fail_without_note"); if (!active.some((e) => e.checklistItemKey === a.key)) gaps.add("fail_item_without_photo"); }
  for (const d of report.defects) if (d.severity === "CRITICAL" && !active.some((e) => e.defectKey === d.key)) gaps.add("critical_defect_without_photo");
  if (args.evidence.some((e) => e.status === "PENDING_UPLOAD")) gaps.add("evidence_uploading");
  if (active.length < (type === "PROGRESS_VERIFICATION" || type === "FINAL_HANDOVER" ? 2 : 1)) gaps.add("not_enough_evidence");
  if (isProgressType(type)) {
    if (report.measuredProgress === undefined || report.measuredProgress === null) gaps.add("measured_progress_required");
    else if (overThreshold(report.measuredProgress, claimed) && !report.discrepancyNote?.trim()) gaps.add("discrepancy_note_required");
  }
  if (!report.inspectorDeclaration) gaps.add("declaration_required");
  return [...gaps];
}

export const emptyReport = (): Report => ({ revision: 0, checklist: [], defects: [], followUpChecks: [], followUpRequired: false, milestoneAssessments: [], inspectorDeclaration: false });

/** Stable comparison for "does the local mirror differ from the server copy". */
export const sameReport = (a: Report, b: Report): boolean => JSON.stringify({ ...a, revision: 0 }) === JSON.stringify({ ...b, revision: 0 });

export const newDefectKey = (existing: string[]): string => { let i = existing.length + 1; while (existing.includes(`defect_${i}`)) i += 1; return `defect_${i}`; };
