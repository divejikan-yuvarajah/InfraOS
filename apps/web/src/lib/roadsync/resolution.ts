import type { Band } from "./assessment";

/** Steps 76-77 read models, exactly as the API sends them. Display text is composed client-side from codes. */
export const RESOLUTION_TYPES = ["amendment", "directive", "risk_acceptance", "no_action", "opportunity"] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];
export type ResolutionStatus = "draft" | "pending_approval" | "approved" | "applying" | "verifying" | "resolved" | "needs_followup" | "cancelled";
export type AmendmentStatus = "draft" | "pending_approval" | "approved" | "rejected" | "applied" | "cancelled" | "stale";
export type ApprovalStep = "agency_admin" | "party_confirmation" | "national" | "national_second";
export type WorkingHours = "day" | "night" | "24h";
export const NO_ACTION_CODES = ["false_positive_geometry", "different_depth_levels", "already_coordinated_offline", "works_completed_or_withdrawn", "other"] as const;
export const MITIGATION_CODES = ["traffic_management_plan", "night_work_only", "flagger_deployment", "public_notice", "enhanced_supervision", "utility_locating_survey", "daily_coordination_call", "other"] as const;
export const JUSTIFICATION_MIN = 30;
export const REASON_MIN = 10;

export type ThirdParty = { newConflicts: number; worsened: number; cleared: number };
export type AmendmentImpact = { thirdParty: ThirdParty } & Record<string, unknown>;
export type DateSpan = { plannedStart: string | null; plannedEnd: string | null };
export type AmendmentView = {
  id: string; amendmentNo: string; workRequestId: string; agencyId: string; agencyName: string | null; status: AmendmentStatus; mandated: boolean; source: string; mine: boolean;
  changes: { schedule: { before: DateSpan; after: DateSpan; shiftDays: number } | null; workingHours: WorkingHours | null };
  impact: AmendmentImpact | null; appliedAt: string | null; allowed: string[];
};
export type ApprovalView = { id: string; step: ApprovalStep; agencyId: string | null; agencyName: string | null; amendmentId: string | null; status: string; at: string | null; byMe: boolean; note?: string; dueAt: string | null; overdue: boolean; soloApproval: boolean; routedNoSecondAdmin: boolean; onBehalf: boolean };
export type CommitmentView = { id: string; agencyId: string; agencyName: string | null; code: string; status: string; text?: string; doneAt: string | null };
export type Verification = { requestedAt: string | null; assessedAt: string | null; result: "pending" | "cleared" | "reduced" | "unchanged" | "worse" | "delayed" } & Record<string, unknown>;
export type ResolutionView = {
  id: string; resolutionNo: string; conflictId: string; conflictNo: string; type: ResolutionType; status: ResolutionStatus; active: boolean; version: number; createdAt: string | null; closedAt: string | null;
  contested: { at: string | null; reason?: string } | null;
  initiator: { agencyId: string; agencyName: string | null; onBehalf: boolean };
  plan: {
    noAction?: { reasonCode: string; note?: string };
    riskAcceptance?: { acceptedBand: Band; acceptedScore: number; mitigations: { code: string; text?: string }[]; justification?: string };
    directive?: { deadlineAt: string | null; overdue: boolean; justification?: string };
    opportunity?: { leadAgencyId: string | null; note?: string };
  };
  approvals: ApprovalView[]; commitments: CommitmentView[]; verification: Verification | null;
  outcome: ({ code: string; resolvedAt: string | null } & Record<string, unknown>) | null;
  amendments: AmendmentView[]; allowed: string[];
};
export type ResolutionHistoryRow = { id: string; resolutionNo: string; type: ResolutionType; status: ResolutionStatus; outcome: string | null; closedAt: string | null };
export type ConflictResolution = { resolution: ResolutionView | null; history: ResolutionHistoryRow[]; recordStatus: string; recordVersion: number; national: boolean; canReopen: boolean; canStart: boolean };
export type ResolutionSuggestions = {
  open: boolean;
  agreed: { coordinationRequestId: string; requestNo: string; type: string; plan: unknown }[];
  targets: { requestId: string; agencyId: string; mine: boolean }[];
  paths: { agreedTerms: boolean; manual: boolean; opportunity: boolean; noAction: boolean; directive: boolean; riskAcceptance: boolean };
  limits: { justificationMin: number; reasonMin: number; directiveDefaultDays: number; directiveMaxDays: number };
};
export type PreviewItem = { targetRequestId: string; shiftDays: number; impact: AmendmentImpact };
export type ImpactPreview = { items: PreviewItem[]; combined: ThirdParty };
export type ChangeInput = { targetRequestId: string; schedule?: { plannedStart: string; plannedEnd: string }; workingHours?: WorkingHours };
export type CreateResolutionBody = {
  type: ResolutionType; source?: { coordinationRequestId: string }; manual?: ChangeInput;
  noAction?: { reasonCode: string; note?: string };
  riskAcceptance?: { justification: string; mitigations: { code: string; text?: string }[] };
  directive?: { justification: string; deadlineAt?: string; targets: ChangeInput[] };
  opportunity?: { leadAgencyId?: string; note?: string };
  onBehalfOfAgencyId?: string; reason?: string;
};

export type QueueRow = {
  resolutionId: string; resolutionNo: string; amendmentNo: string | null; conflictId: string; conflictNo: string; type: ResolutionType; step: ApprovalStep; stepId: string;
  severityAtDetection: Band; dueAt: string | null; overdue: boolean; fourEyesOk: boolean; assigned: boolean; version: number; requestedBy: string | null;
  changes: { before: DateSpan; after: DateSpan; workingHours: WorkingHours | null } | null;
  impact: ({ thirdParty: ThirdParty } & Record<string, unknown>) | null;
};
export type QueueList = { items: QueueRow[]; total: number; page: number; limit: number };

// ---------- coordination history (ledger chronicle) ----------
export type LedgerCategory = "record" | "coordination" | "resolution" | "approval" | "system";
export const LEDGER_CATEGORIES: LedgerCategory[] = ["record", "coordination", "resolution", "approval", "system"];
export type ChronicleItem =
  | { kind: "entry"; seq: number; at: string; recordedAt: string | null; category: LedgerCategory; action: string; entityType: string; entityId: string; entityNo: string | null; actorLabel: { agencyId: string | null; role: string | null; person: boolean }; data: Record<string, unknown>; short: string; hash: string; prevHash: string; stateAfter: { recordStatus: string; severity: { score: number; band: string } | null; coordinationState: string | null; resolutionState: string | null } }
  | { kind: "preledger"; at: string; category: LedgerCategory; action: string; entityType: string; entityNo: string | null }
  | { kind: "hidden"; fromSeq: number; toSeq: number; count: number };
export type Chronicle = { items: ChronicleItem[]; total: number; nextCursor: number | null; hiddenCount: number; integrity: { lastVerified: unknown; count: number; shortHead: string | null } };
export type VerifyOut = { ok: boolean; count: number; firstBrokenSeq?: number | null; reason?: string; shortHead: string | null; headHash?: string; notice: string };
export type ArchiveRow = { conflictId: string; conflictNo: string; status: string; outcome: string; resolutionNo: string | null; resolutionType: string | null; severityAtDetection: Band; severityAtResolution: Band | null; durationDays: number; amendmentsApplied: number; openCommitments: number; closedAt: string | null };
export type Archive = { total: number; page: number; limit: number; items: ArchiveRow[]; tiles: Record<string, number> };

// ---------- pure helpers ----------
export const RAIL: ResolutionStatus[] = ["draft", "pending_approval", "approved", "applying", "verifying", "resolved"];
/** Progress rail position (0-based) for the happy path; needs_followup sits at verifying, cancelled is off the rail (-1). */
export function railIndex(status: ResolutionStatus): number {
  if (status === "needs_followup") return 4;
  return RAIL.indexOf(status);
}
export const isClosed = (s: ResolutionStatus) => s === "resolved" || s === "cancelled";
export const toIso = (local: string): string => new Date(local).toISOString();
export const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
