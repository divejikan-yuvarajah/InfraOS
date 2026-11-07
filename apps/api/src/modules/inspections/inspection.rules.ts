import { checklistFor } from "./inspection-checklists.js";
import {
  DISCREPANCY_THRESHOLD_PP, MAX_SUBMISSIONS, PROGRESS_TYPES, SITE_NEAR_M, SITE_ON_M, START_WINDOW_HOURS, TERMINAL_STATUSES,
  type InspectionStatus, type InspectionType,
} from "./inspection.constants.js";

/* ---------- workflow transition table (single source of truth) ---------- */

export type Action = "EDIT" | "RESCHEDULE" | "REASSIGN" | "CANCEL" | "START" | "SAVE_DRAFT" | "SUBMIT" | "APPROVE" | "REQUEST_REVISION" | "REJECT";

/** Which statuses each action may start from, and the status it produces (null = unchanged). */
export const TRANSITIONS: Record<Action, { from: readonly InspectionStatus[]; to: InspectionStatus | null }> = {
  EDIT: { from: ["SCHEDULED"], to: null },
  RESCHEDULE: { from: ["SCHEDULED", "IN_PROGRESS"], to: null },
  REASSIGN: { from: ["SCHEDULED", "IN_PROGRESS"], to: null },
  CANCEL: { from: ["SCHEDULED", "IN_PROGRESS"], to: "CANCELLED" },
  START: { from: ["SCHEDULED"], to: "IN_PROGRESS" },
  SAVE_DRAFT: { from: ["IN_PROGRESS", "REQUIRES_REVIEW"], to: null },
  SUBMIT: { from: ["IN_PROGRESS", "REQUIRES_REVIEW"], to: "SUBMITTED" },
  APPROVE: { from: ["SUBMITTED"], to: "VERIFIED" },
  REQUEST_REVISION: { from: ["SUBMITTED"], to: "REQUIRES_REVIEW" },
  REJECT: { from: ["SUBMITTED", "REQUIRES_REVIEW"], to: "REJECTED" },
};

export const canTransition = (action: Action, status: InspectionStatus): boolean => TRANSITIONS[action].from.includes(status);
export const isTerminal = (status: InspectionStatus): boolean => TERMINAL_STATUSES.includes(status);

/** REJECT from REQUIRES_REVIEW is only legal once the submission cap is reached (otherwise a revision is simply awaited). */
export function rejectAllowed(status: InspectionStatus, submissionCount: number): boolean {
  if (status === "SUBMITTED") return true;
  return status === "REQUIRES_REVIEW" && submissionCount >= MAX_SUBMISSIONS;
}

/** Reviewer must differ from the submitter and from the assigned inspector. */
export function makerCheckerOk(reviewerId: string, lastSubmitterId: string | null, inspectorId: string): boolean {
  return reviewerId !== lastSubmitterId && reviewerId !== inspectorId;
}

/* ---------- dates ---------- */

export const isOverdue = (status: InspectionStatus, date: Date, durationMinutes: number | undefined, now = new Date()): boolean =>
  (status === "SCHEDULED" || status === "IN_PROGRESS") && date.getTime() + (durationMinutes ?? 120) * 60_000 < now.getTime();

export const startWindowOpen = (date: Date, now = new Date()): boolean => now.getTime() >= date.getTime() - START_WINDOW_HOURS * 3_600_000;
export const scheduleDateOk = (date: Date, now = new Date()): boolean => date.getTime() > now.getTime() - 3_600_000;

export const COLOMBO_OFFSET_MIN = 330;
/** Start of the Colombo (UTC+5:30) calendar day containing `d`, as a UTC instant. */
export function colomboDayStart(d: Date): Date {
  const shifted = new Date(d.getTime() + COLOMBO_OFFSET_MIN * 60_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - COLOMBO_OFFSET_MIN * 60_000);
}
export const MAX_CALENDAR_DAYS = 62;
export function calendarWindowOk(from: Date, to: Date): boolean {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  return Number.isFinite(days) && days > 0 && days <= MAX_CALENDAR_DAYS;
}
export const overlaps = (aStart: Date, aMin: number, bStart: Date, bMin: number): boolean =>
  aStart.getTime() < bStart.getTime() + bMin * 60_000 && bStart.getTime() < aStart.getTime() + aMin * 60_000;

/* ---------- progress ---------- */

export const isProgressType = (t: InspectionType): boolean => PROGRESS_TYPES.includes(t);
export const discrepancyPp = (verified: number, claimed: number | null | undefined): number | null =>
  claimed === null || claimed === undefined ? null : Math.round(verified) - Math.round(claimed);
export const overThreshold = (verified: number, claimed: number | null | undefined): boolean => {
  const d = discrepancyPp(verified, claimed);
  return d !== null && Math.abs(d) > DISCREPANCY_THRESHOLD_PP;
};

/* ---------- submit completeness ---------- */

export type ReportInput = {
  checklist: { key: string; result: string; note?: string | null }[];
  defects: { key: string; severity: string; evidenceIds?: unknown[] }[];
  measuredProgress?: number | null;
  discrepancyNote?: string | null;
  inspectorDeclaration?: boolean | null;
};
export type EvidenceLink = { checklistItemKey?: string | null; defectKey?: string | null };

export type Gap =
  | "checklist_incomplete" | "fail_without_note" | "not_enough_evidence" | "fail_item_without_photo" | "critical_defect_without_photo"
  | "measured_progress_required" | "discrepancy_note_required" | "declaration_required";

/** Returns every reason a report cannot yet be submitted (empty list = complete). */
export function submitGaps(type: InspectionType, report: ReportInput, evidence: EvidenceLink[], claimed: number | null | undefined): Gap[] {
  const gaps = new Set<Gap>();
  const answers = new Map(report.checklist.map((c) => [c.key, c]));
  for (const item of checklistFor(type)) {
    const a = answers.get(item.key);
    if (item.mandatory && (!a || a.result === "NOT_CHECKED")) gaps.add("checklist_incomplete");
  }
  for (const a of report.checklist) {
    if (a.result === "FAIL") {
      if (!a.note?.trim()) gaps.add("fail_without_note");
      if (!evidence.some((e) => e.checklistItemKey === a.key)) gaps.add("fail_item_without_photo");
    }
  }
  for (const d of report.defects) if (d.severity === "CRITICAL" && !evidence.some((e) => e.defectKey === d.key)) gaps.add("critical_defect_without_photo");
  const minEvidence = type === "PROGRESS_VERIFICATION" || type === "FINAL_HANDOVER" ? 2 : 1;
  if (evidence.length < minEvidence) gaps.add("not_enough_evidence");
  if (isProgressType(type)) {
    if (report.measuredProgress === null || report.measuredProgress === undefined) gaps.add("measured_progress_required");
    else if (overThreshold(report.measuredProgress, claimed) && !report.discrepancyNote?.trim()) gaps.add("discrepancy_note_required");
  }
  if (report.inspectorDeclaration !== true) gaps.add("declaration_required");
  return [...gaps];
}

/* ---------- site presence (informational only) ---------- */

export type LonLat = [number, number];
export function haversineM(a: LonLat, b: LonLat): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Geo = { type: string; coordinates: unknown };
/** Flattens geometry vertices, sampling at most `cap` of them. */
export function vertices(g: Geo | null | undefined, cap = 500): LonLat[] {
  if (!g) return [];
  const out: LonLat[] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && c.length === 2 && typeof c[0] === "number" && typeof c[1] === "number") { out.push([c[0], c[1]]); return; }
    if (Array.isArray(c)) c.forEach(walk);
  };
  walk(g.coordinates);
  if (out.length <= cap) return out;
  const step = Math.ceil(out.length / cap);
  return out.filter((_, i) => i % step === 0);
}
export function representativePoint(g: Geo | null | undefined): LonLat | null {
  const v = vertices(g);
  if (!v.length) return null;
  const mid = v[Math.floor(v.length / 2)]!;
  return mid;
}

export type SitePresence = { distanceM: number; status: "ON_SITE" | "NEAR_SITE" | "AWAY"; basis: "project_geometry" | "inspection_site_point" };
export function sitePresence(photo: LonLat, sitePoint: LonLat | null, geometry: Geo | null | undefined): SitePresence | null {
  if (sitePoint) {
    const d = Math.round(haversineM(photo, sitePoint));
    return { distanceM: d, status: d <= SITE_ON_M ? "ON_SITE" : d <= SITE_NEAR_M ? "NEAR_SITE" : "AWAY", basis: "inspection_site_point" };
  }
  const v = vertices(geometry);
  if (!v.length) return null;
  const d = Math.round(Math.min(...v.map((p) => haversineM(photo, p))));
  return { distanceM: d, status: d <= SITE_ON_M ? "ON_SITE" : d <= SITE_NEAR_M ? "NEAR_SITE" : "AWAY", basis: "project_geometry" };
}

/* ---------- upload validation ---------- */

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
export const IMAGE_MIMES: readonly ImageMime[] = ["image/jpeg", "image/png", "image/webp"];

/** Detects the real format from magic bytes. The declared mime is never trusted. */
export function sniffImage(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
