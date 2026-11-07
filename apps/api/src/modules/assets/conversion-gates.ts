/**
 * Handover Readiness: the conversion eligibility checklist. Pure functions only. The same input builder is used live in the wizard,
 * at request time and again inside the approve transaction, so what the user saw is what the server enforces.
 * BLOCK prevents the request or the approval. WARN is shown, must be acknowledged, and is recorded in the gate snapshot.
 */
export type GateStatus = "PASS" | "WARN" | "BLOCK" | "SKIPPED";
export type ConversionGate = { key: string; status: GateStatus; message: string; values: Record<string, string | number | null> };

export type ConversionGateInput = {
  projectStatus: string;
  /** Latest ACTIVE progress verification percentage, or null when none. */
  verifiedPercent: number | null;
  finalHandoverVerified: boolean;
  hasValidGeometry: boolean;
  /** Unresolved CRITICAL or MAJOR defects in the latest approved inspection. */
  openFindings: number;
  /** Payments still PENDING or APPROVED (not yet paid). */
  unpaidPayments: number;
  /** Expenses waiting for verification. */
  pendingExpenses: number;
  retentionOutstanding: boolean;
  activeAssignments: number;
  receivingAgency: { exists: boolean; active: boolean };
  existingConversion: { status: "PENDING_APPROVAL" | "APPROVED"; conversionNo?: string | null } | null;
  /** null when no approver is being evaluated (preview, request). */
  approverIsRequester: boolean | null;
  documentCount: number;
};

const gate = (key: string, status: GateStatus, message: string, values: ConversionGate["values"] = {}): ConversionGate => ({ key, status, message, values });

export const projectCompleted = (i: ConversionGateInput): ConversionGate =>
  i.projectStatus === "COMPLETED" ? gate("PROJECT_COMPLETED", "PASS", "The project is completed.", { projectStatus: i.projectStatus }) : gate("PROJECT_COMPLETED", "BLOCK", "Only a completed project can be converted to assets.", { projectStatus: i.projectStatus });

export const verifiedCompletion = (i: ConversionGateInput): ConversionGate => {
  if (i.verifiedPercent === 100) return gate("VERIFIED_COMPLETION", "PASS", "Completion is verified at 100% by an approved inspection.", { satisfiedBy: "VERIFICATION", verifiedPercent: 100 });
  if (i.finalHandoverVerified) return gate("VERIFIED_COMPLETION", "PASS", "A final-handover inspection has been approved.", { satisfiedBy: "FINAL_HANDOVER", verifiedPercent: i.verifiedPercent });
  return gate("VERIFIED_COMPLETION", "BLOCK", "Completion is not verified. It needs an approved 100% verification or an approved final-handover inspection.", { verifiedPercent: i.verifiedPercent });
};

export const geometry = (i: ConversionGateInput): ConversionGate =>
  i.hasValidGeometry ? gate("GEOMETRY", "PASS", "The project has a valid map location.") : gate("GEOMETRY", "WARN", "The project has no valid geometry, so its assets will not appear on InfraMap.");

export const openFindings = (i: ConversionGateInput): ConversionGate =>
  i.openFindings > 0 ? gate("OPEN_FINDINGS", "WARN", "The latest approved inspection recorded major or critical defects that are not resolved.", { count: i.openFindings }) : gate("OPEN_FINDINGS", "PASS", "No unresolved major or critical findings.", { count: 0 });

export const financialClosure = (i: ConversionGateInput): GateResult => {
  const open = i.unpaidPayments + i.pendingExpenses;
  if (open === 0 && !i.retentionOutstanding) return gate("FINANCIAL_CLOSURE", "PASS", "No unpaid payments or unverified expenses.", { unpaidPayments: 0, pendingExpenses: 0 });
  return gate("FINANCIAL_CLOSURE", "WARN", i.retentionOutstanding && open === 0 ? "Retention payments are still outstanding." : "Payments are unpaid or expenses are awaiting verification.", { unpaidPayments: i.unpaidPayments, pendingExpenses: i.pendingExpenses, retention: i.retentionOutstanding ? 1 : 0 });
};
type GateResult = ConversionGate;

export const contractorHandover = (i: ConversionGateInput): ConversionGate =>
  i.activeAssignments > 0 ? gate("CONTRACTOR_HANDOVER", "WARN", "Contractor assignments are still open. Consider ending them before handover.", { count: i.activeAssignments }) : gate("CONTRACTOR_HANDOVER", "PASS", "No open contractor assignments.", { count: 0 });

export const receivingAgency = (i: ConversionGateInput): ConversionGate =>
  i.receivingAgency.exists && i.receivingAgency.active ? gate("RECEIVING_AGENCY", "PASS", "The receiving agency is active.") : gate("RECEIVING_AGENCY", "BLOCK", "The receiving agency does not exist or is not active.");

export const duplicate = (i: ConversionGateInput): ConversionGate =>
  i.existingConversion ? gate("DUPLICATE", "BLOCK", i.existingConversion.status === "APPROVED" ? "This project was already converted." : "A conversion request for this project is already waiting for approval.", { status: i.existingConversion.status, conversionNo: i.existingConversion.conversionNo ?? null }) : gate("DUPLICATE", "PASS", "No conversion exists for this project.");

export const makerChecker = (i: ConversionGateInput): ConversionGate => {
  if (i.approverIsRequester === null) return gate("MAKER_CHECKER", "SKIPPED", "Checked when someone other than the requester decides.");
  return i.approverIsRequester ? gate("MAKER_CHECKER", "BLOCK", "You requested this conversion, so another approver must decide it.") : gate("MAKER_CHECKER", "PASS", "A different person is deciding.");
};

export const documents = (i: ConversionGateInput): ConversionGate =>
  i.documentCount > 0 ? gate("DOCUMENTS", "PASS", "Completion documents are referenced.", { count: i.documentCount }) : gate("DOCUMENTS", "WARN", "No completion documents are referenced.", { count: 0 });

export const CONVERSION_GATES: readonly ((i: ConversionGateInput) => ConversionGate)[] = [projectCompleted, verifiedCompletion, geometry, openFindings, financialClosure, contractorHandover, receivingAgency, duplicate, makerChecker, documents];
export const evaluateConversionGates = (i: ConversionGateInput): ConversionGate[] => CONVERSION_GATES.map((g) => g(i));
export const blockedGates = (gates: readonly ConversionGate[]): ConversionGate[] => gates.filter((g) => g.status === "BLOCK");
export const warningGates = (gates: readonly ConversionGate[]): ConversionGate[] => gates.filter((g) => g.status === "WARN");
