/**
 * Step 76 pure engine: terms -> plan, approval policy, status derivation, verification and permission rules.
 * No I/O, no clocks (callers pass `now`). Free text never appears in any returned code or event.
 */
import { BAND_CODES, type Band } from "./assessment.rules.js";
import { RECORD } from "./conflict-record.rules.js";
import { RES, type AmendmentStatus, type ApprovalStep, type ResolutionStatus, type ResolutionType, type VerifyResult } from "./resolution.rules.js";

const DAY = 86_400_000;
const rank = (b: Band) => BAND_CODES.indexOf(b);

// ---------- terms -> plan ----------

export type AgreedLike = { proposal: { type: string; before: Record<string, unknown>; after: Record<string, unknown>; derived?: Record<string, unknown> }; conditions: { agencyId: string; code: string; text?: string }[]; acceptedBy: { agencyId: string }[] };
export type PairIds = { aId: string; bId: string; aType: string; bType: string; aAgencyId: string; bAgencyId: string };
export type PlannedAmendment = { workRequestId: string; agencyId: string; schedule: { plannedStart: string; plannedEnd: string } };
export type Commitment = { agencyId: string; code: string; text?: string };
export type Plan = { amendments: PlannedAmendment[]; opportunity: { leadAgencyId: string | null } | null; commitments: Commitment[]; unsupported: string[] };

/** Only owner-agency requests are targeted; work requests carry no working-hours field, so hours agreements become commitments. */
export function termsToPlan(agreed: AgreedLike, p: PairIds): Plan {
  const out: Plan = { amendments: [], opportunity: null, commitments: [], unsupported: [] };
  const ownerOf = (id: unknown) => (id === p.aId && p.aType === "work_request" ? p.aAgencyId : id === p.bId && p.bType === "work_request" ? p.bAgencyId : null);
  const { type, after, derived } = agreed.proposal;
  const target = type === "sequence_order" ? derived?.secondRequestId : after.targetRequestId;
  const owner = ownerOf(target);
  if (type === "schedule_shift" && owner) out.amendments.push({ workRequestId: String(target), agencyId: owner, schedule: { plannedStart: String(after.start), plannedEnd: String(after.end) } });
  else if (type === "sequence_order" && owner && derived?.newStart && derived?.newEnd) out.amendments.push({ workRequestId: String(target), agencyId: owner, schedule: { plannedStart: String(derived.newStart), plannedEnd: String(derived.newEnd) } });
  else if (type === "working_hours" && owner) { out.unsupported.push("working_hours"); out.commitments.push({ agencyId: owner, code: `working_hours_${String(after.workingHours)}` }); }
  else if (type === "joint_works") out.opportunity = { leadAgencyId: typeof after.leadAgencyId === "string" ? after.leadAgencyId : null };
  else if (type === "traffic_management" && Array.isArray(after.measures)) {
    const first = agreed.acceptedBy[0]?.agencyId ?? p.aAgencyId;
    for (const m of after.measures as unknown[]) out.commitments.push({ agencyId: first, code: String(m) });
  }
  for (const c of agreed.conditions) out.commitments.push({ agencyId: c.agencyId, code: c.code, ...(c.text ? { text: c.text } : {}) });
  out.commitments = out.commitments.slice(0, RES.COMMITMENTS_MAX);
  return out;
}

// ---------- national approval policy ----------

export type ThirdParty = { newConflicts: number; worsened: number; cleared: number };
/** Reasons are i18n codes. Evaluated at submission AND again at apply time. Emergency work is not modelled on work requests, so rule (c) cannot fire. */
export function nationalReasons(i: { type: ResolutionType; thirdParty: ThirdParty | null; severityAtDetection: Band; shiftDays: number; band: Band }): string[] {
  const r: string[] = [];
  if (i.thirdParty && i.thirdParty.newConflicts > 0) r.push("third_party_new_conflicts");
  if (i.thirdParty && i.thirdParty.worsened > 0) r.push("third_party_worsened");
  if (i.severityAtDetection === "critical") r.push("critical_severity");
  if (Math.abs(i.shiftDays) > RES.NATIONAL_APPROVAL_SHIFT_DAYS) r.push("large_shift");
  if (i.type === "risk_acceptance") r.push("risk_acceptance");
  if (i.type === "no_action" && rank(i.band) >= rank("high")) r.push("no_action_high_band");
  return r;
}

// ---------- approvals ----------

export type Approval = { id: string; step: ApprovalStep; agencyId?: string; amendmentId?: string; required: boolean; status: "pending" | "approved" | "rejected" | "skipped"; by: string | null; at: Date | null; note: string | null; dueAt: Date; soloApproval?: boolean; routedNoSecondAdmin?: boolean; onBehalf?: boolean };
type ChainInput =
  | { kind: "amendment"; amendmentId: string; ownerAgencyId: string; hasSecondAdmin: boolean; nationalNeeded: boolean; now: Date }
  | { kind: "confirm"; requiredAgencyIds: string[]; nationalNeeded: boolean; now: Date }
  | { kind: "risk"; hasSecondNational: boolean; now: Date };

export function buildApprovals(i: ChainInput): Approval[] {
  const dueAt = new Date(i.now.getTime() + RES.APPROVAL_DUE_DAYS * DAY);
  const mk = (step: ApprovalStep, extra: Partial<Approval> = {}): Approval => ({ id: `${extra.amendmentId ?? "res"}:${step}:${extra.agencyId ?? ""}`, step, required: true, status: "pending", by: null, at: null, note: null, dueAt, ...extra });
  if (i.kind === "amendment") {
    const out = i.hasSecondAdmin ? [mk("agency_admin", { agencyId: i.ownerAgencyId, amendmentId: i.amendmentId })] : [mk("national", { amendmentId: i.amendmentId, routedNoSecondAdmin: true })];
    if (i.nationalNeeded && !out.some((a) => a.step === "national")) out.push(mk("national", { amendmentId: i.amendmentId }));
    return out;
  }
  if (i.kind === "confirm") {
    const out = i.requiredAgencyIds.map((agencyId) => mk("party_confirmation", { agencyId }));
    if (i.nationalNeeded) out.push(mk("national"));
    return out;
  }
  const out = [mk("national", i.hasSecondNational ? {} : { soloApproval: true })];
  if (RES.RISK_ACCEPT_FOUR_EYES && i.hasSecondNational) out.push(mk("national_second"));
  return out;
}

export type Viewer = { userId: string; agencyId: string; roleKey: string; national: boolean; scopeIds: ReadonlySet<string> };
export const isAdmin = (v: Viewer) => v.roleKey === "GOV_ADMIN";
export const isOfficer = (v: Viewer) => v.roleKey === "GOV_ADMIN" || v.roleKey === "AGENCY_OFFICER" || v.roleKey === "PROJECT_MANAGER";
const own = (v: Viewer, agencyId: string | undefined) => Boolean(agencyId) && (v.agencyId === agencyId || v.scopeIds.has(agencyId!));

/** Four-eyes: nobody approves their own submission, and a second national cannot be the same person as the first. */
export function canApprove(step: Approval, v: Viewer, ctx: { submitterUserId: string; firstNationalUserId?: string | null; onBehalfOfAgencyId?: string }): "ok" | "forbidden" | "four_eyes" {
  if (step.status !== "pending") return "forbidden";
  if (v.userId === ctx.submitterUserId && !step.soloApproval) return "four_eyes";
  if (step.step === "national") return v.national ? "ok" : "forbidden";
  if (step.step === "national_second") return v.national ? (v.userId === ctx.firstNationalUserId ? "four_eyes" : "ok") : "forbidden";
  if (step.step === "agency_admin") return (isAdmin(v) && own(v, step.agencyId)) || (v.national && ctx.onBehalfOfAgencyId === step.agencyId) ? "ok" : "forbidden";
  return (isOfficer(v) && own(v, step.agencyId)) || (v.national && ctx.onBehalfOfAgencyId === step.agencyId) ? "ok" : "forbidden";
}

// ---------- status derivation ----------

export type DeriveInput = { type: ResolutionType; current: ResolutionStatus; amendments: AmendmentStatus[]; approvals: Pick<Approval, "status">[]; verification: VerifyResult | null };
/** Status is derived after every action; `cancelled` and terminal states are sticky. */
export function deriveStatus(i: DeriveInput): ResolutionStatus {
  if (i.current === "cancelled" || i.current === "resolved") return i.current;
  if (i.type === "amendment" || i.type === "directive") {
    const live = i.amendments.filter((s) => s !== "cancelled" && s !== "rejected" && s !== "stale");
    if (!live.length) return "draft";
    const applied = live.filter((s) => s === "applied").length;
    if (applied === live.length) return i.verification === "cleared" ? "resolved" : i.verification && i.verification !== "pending" && i.verification !== "delayed" ? "needs_followup" : "verifying";
    if (applied > 0) return "applying";
    if (live.every((s) => s === "approved")) return "approved";
    return live.some((s) => s === "pending_approval") ? "pending_approval" : "draft";
  }
  if (i.approvals.some((a) => a.status === "pending")) return "pending_approval";
  return i.approvals.length && i.approvals.every((a) => a.status === "approved" || a.status === "skipped") ? "resolved" : "pending_approval";
}

// ---------- verification ----------

export type PairNow = { active: boolean; kind: string; score: number; band: Band } | null;
export function verifyResult(before: { score: number; band: Band }, now: PairNow): VerifyResult {
  if (!now || !now.active || now.kind !== "conflict" || now.score < RECORD.RECORD_MIN_SCORE) return "cleared";
  if (rank(now.band) > rank(before.band)) return "worse";
  if (rank(now.band) < rank(before.band)) return "reduced";
  return now.score < before.score ? "reduced" : "unchanged";
}

export const verificationDelayed = (requestedAt: Date | null, now: Date) => Boolean(requestedAt) && now.getTime() - requestedAt!.getTime() > RES.VERIFY_DELAY_MINUTES * 60_000;

// ---------- dates ----------

export type DateCheck = { code: string; ok: boolean };
export function validateDates(start: Date, end: Date, now: Date): DateCheck[] {
  const days = (end.getTime() - start.getTime()) / DAY;
  return [
    { code: "dates_valid", ok: !Number.isNaN(days) && days >= 0 && days <= RES.MAX_DURATION_DAYS },
    { code: "start_not_past", ok: start.getTime() >= now.getTime() - DAY },
  ];
}
export const shiftDays = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY);

// ---------- allowed actions ----------

export type AmendmentView = { id: string; agencyId: string; status: AmendmentStatus; createdByUserId: string; mandated: boolean };
/** ONE function decides what the viewer may do on an amendment; the UI renders it and the server re-checks every call. */
export function amendmentActions(a: AmendmentView, res: { status: ResolutionStatus; approvals: Approval[]; submitterUserId: string; firstNationalUserId?: string | null }, v: Viewer): string[] {
  const out: string[] = [];
  const mine = own(v, a.agencyId);
  const closed = res.status === "cancelled" || res.status === "resolved";
  if (closed) return out;
  if (a.status === "draft" && ((mine && isOfficer(v)) || v.national)) out.push("submit");
  if (a.status === "draft" || a.status === "pending_approval") if (v.userId === a.createdByUserId || v.national) out.push("cancel");
  if (a.status === "pending_approval") {
    const step = res.approvals.find((s) => s.amendmentId === a.id && s.status === "pending");
    if (step && canApprove(step, v, { submitterUserId: res.submitterUserId, firstNationalUserId: res.firstNationalUserId, onBehalfOfAgencyId: v.national ? step.agencyId : undefined }) === "ok") out.push("approve", "reject");
  }
  if (a.status === "approved" && (mine && isOfficer(v) || v.national)) out.push("apply");
  if (a.status === "stale" && (mine || v.national)) out.push("regenerate");
  return out;
}
