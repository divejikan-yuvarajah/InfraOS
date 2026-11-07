import { overBy } from "./finance.money.js";

/**
 * Payment Gate Checklist: an array of small pure functions. BLOCK makes approve and mark-paid impossible; WARN is shown, must be acknowledged
 * and is recorded in the audit reason. Batch 06 can append an "inspection hold" gate and Batch 07 an "asset handover" gate to GATES.
 */
export type GateStatus = "PASS" | "WARN" | "BLOCK" | "SKIPPED";
export type Gate = { key: string; status: GateStatus; message: string; values: Record<string, string | number | null> };

export type ProgressBasis = "VERIFIED_INSPECTION" | "REPORTED_UNVERIFIED" | "NONE";

export type GateInput = {
  paymentType: string;
  amountMinor: number;
  projectStatus: string;
  contractor: { status: string } | null;
  hasAssignment: boolean;
  budgetMinor: number;
  paidMinor: number;
  approvedUnpaidMinor: number;
  /** Amount of this payment when it is already counted in approvedUnpaid/paid (re-evaluation at approve time). */
  alreadyCountedMinor: number;
  contractValueMinor: number | null;
  assignmentCumulativeMinor: number;
  duplicateInvoice: boolean;
  progress: { valueBp: number | null; basis: ProgressBasis };
  /** null when no actor is evaluated (preview before the requester exists). */
  actorIsRequester: boolean | null;
};

export const ELIGIBLE_PROJECT_STATUSES = ["APPROVED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED"] as const;
const HOLD_OK_TYPES = ["FINAL", "RETENTION", "OTHER"];
export const PROGRESS_TOLERANCE_BP = 1000; // 10 percentage points
export const FINAL_MIN_PROGRESS_BP = 9500;

const gate = (key: string, status: GateStatus, message: string, values: Gate["values"] = {}): Gate => ({ key, status, message, values });

export const projectEligible = (i: GateInput): Gate => {
  const ok = (ELIGIBLE_PROJECT_STATUSES as readonly string[]).includes(i.projectStatus);
  if (!ok) return gate("PROJECT_ELIGIBLE", "BLOCK", "The project is not in a state that can take payments.", { projectStatus: i.projectStatus });
  if (i.projectStatus === "ON_HOLD" && !HOLD_OK_TYPES.includes(i.paymentType)) return gate("PROJECT_ELIGIBLE", "BLOCK", "A project on hold accepts only final, retention or other payments.", { projectStatus: i.projectStatus, paymentType: i.paymentType });
  return gate("PROJECT_ELIGIBLE", "PASS", "The project can take this payment.", { projectStatus: i.projectStatus });
};

export const contractorEligible = (i: GateInput): Gate => {
  if (!i.contractor || !i.hasAssignment) return gate("CONTRACTOR_ELIGIBLE", "BLOCK", "The contractor has no assignment on this project.", {});
  if (i.contractor.status !== "ACTIVE") return gate("CONTRACTOR_ELIGIBLE", "BLOCK", "The contractor is not active.", { contractorStatus: i.contractor.status });
  return gate("CONTRACTOR_ELIGIBLE", "PASS", "The contractor is active and assigned.", {});
};

export const budgetHeadroom = (i: GateInput): Gate => {
  const committed = BigInt(i.paidMinor) + BigInt(i.approvedUnpaidMinor) - BigInt(i.alreadyCountedMinor) + BigInt(i.amountMinor);
  const budget = BigInt(i.budgetMinor);
  const over = committed > budget ? Number(committed - budget) : 0;
  const values = { budgetMinor: i.budgetMinor, committedAfterMinor: Number(committed), overByMinor: over };
  if (i.budgetMinor <= 0) return gate("BUDGET_HEADROOM", "BLOCK", "The project has no approved budget.", values);
  return over > 0 ? gate("BUDGET_HEADROOM", "BLOCK", "Approving this would exceed the approved budget. Resolve it with an approved budget revision.", values) : gate("BUDGET_HEADROOM", "PASS", "Within the approved budget.", values);
};

export const contractCap = (i: GateInput): Gate => {
  if (i.contractValueMinor === null) return gate("CONTRACT_CAP", "SKIPPED", "n/a: no contract value is recorded for this assignment.", {});
  const cumulative = Number(BigInt(i.assignmentCumulativeMinor) - BigInt(Math.min(i.alreadyCountedMinor, i.assignmentCumulativeMinor)) + BigInt(i.amountMinor));
  const over = overBy(cumulative, i.contractValueMinor);
  const values = { contractValueMinor: i.contractValueMinor, cumulativeAfterMinor: cumulative, overByMinor: over };
  return over > 0 ? gate("CONTRACT_CAP", "WARN", "Cumulative payments to this assignment would exceed its recorded contract value.", values) : gate("CONTRACT_CAP", "PASS", "Within the recorded contract value.", values);
};

export const duplicateInvoice = (i: GateInput): Gate =>
  i.duplicateInvoice ? gate("DUPLICATE_INVOICE", "BLOCK", "This invoice reference is already used for this contractor on this project.", {}) : gate("DUPLICATE_INVOICE", "PASS", "No other active payment uses this invoice reference.", {});

export const progressSupport = (i: GateInput): Gate => {
  if (i.paymentType !== "INTERIM" && i.paymentType !== "FINAL") return gate("PROGRESS_SUPPORT", "SKIPPED", "n/a: only interim and final payments are checked against progress.", {});
  const basis = i.progress.basis;
  if (basis === "NONE" || i.progress.valueBp === null) return gate("PROGRESS_SUPPORT", "WARN", "No physical progress is recorded, so this payment cannot be compared with progress.", { basis });
  const cumulative = BigInt(i.paidMinor) + BigInt(i.approvedUnpaidMinor) - BigInt(i.alreadyCountedMinor) + BigInt(i.amountMinor);
  const cumBp = i.budgetMinor > 0 ? Number((cumulative * 10000n) / BigInt(i.budgetMinor)) : null;
  const values = { cumulativeBp: cumBp, progressBp: i.progress.valueBp, basis };
  if (cumBp !== null && cumBp > i.progress.valueBp + PROGRESS_TOLERANCE_BP) {
    return gate("PROGRESS_SUPPORT", "WARN", basis === "VERIFIED_INSPECTION" ? "Cumulative payments would run more than 10 points ahead of verified progress." : "Cumulative payments would run more than 10 points ahead of reported progress (reported, not verified).", values);
  }
  if (i.paymentType === "FINAL" && i.projectStatus !== "COMPLETED" && i.progress.valueBp < FINAL_MIN_PROGRESS_BP) {
    return gate("PROGRESS_SUPPORT", "WARN", "A final payment is requested but the project is not completed and progress is under 95%.", values);
  }
  return gate("PROGRESS_SUPPORT", "PASS", basis === "VERIFIED_INSPECTION" ? "Supported by verified progress." : "Supported by reported progress (reported, not verified).", values);
};

export const makerChecker = (i: GateInput): Gate => {
  if (i.actorIsRequester === null) return gate("MAKER_CHECKER", "SKIPPED", "Checked when someone other than the requester decides.", {});
  return i.actorIsRequester ? gate("MAKER_CHECKER", "BLOCK", "You requested this payment, so another person must decide it.", {}) : gate("MAKER_CHECKER", "PASS", "A different person is deciding.", {});
};

export const GATES: readonly ((i: GateInput) => Gate)[] = [projectEligible, contractorEligible, budgetHeadroom, contractCap, duplicateInvoice, progressSupport, makerChecker];
export const evaluateGates = (i: GateInput): Gate[] => GATES.map((g) => g(i));
export const blocked = (gates: readonly Gate[]): Gate[] => gates.filter((g) => g.status === "BLOCK");
export const warnings = (gates: readonly Gate[]): Gate[] => gates.filter((g) => g.status === "WARN");
