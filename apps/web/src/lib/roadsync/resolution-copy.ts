import type { AuthLocale } from "@/lib/auth/types";

/**
 * Steps 76-77 copy. The server sends codes and params only; every sentence is composed here.
 * Sinhala and Tamil are drafts pending native review and fall back to English per key (never to a raw code).
 */
const EN = {
  tab: "Resolution", historyTab: "History", demoNote: "Demo and seed data only. Not official government data.",
  loading: "Loading…", retry: "Retry", error: "Could not load this information.", forbidden: "You do not have access to this information.", stale: "This record changed while you were working. It has been refreshed; please review and try again.",
  failed: "The action could not be completed.", done: "Saved.", notFound: "Not found or not visible to your agency.", close: "Cancel", submit: "Confirm", working: "Working…",
  status: { draft: "Draft", pending_approval: "Pending approval", approved: "Approved", applying: "Applying changes", verifying: "Verifying", resolved: "Resolved", needs_followup: "Needs follow-up", cancelled: "Cancelled" } as Record<string, string>,
  types: { amendment: "Schedule amendment", directive: "National directive", risk_acceptance: "Risk acceptance", no_action: "No action needed", opportunity: "Dig-once opportunity" } as Record<string, string>,
  typeHelp: {
    amendment: "Change dates or working hours of the works. Agencies and the national office approve.", directive: "National office orders specific changes with a deadline.",
    risk_acceptance: "National office accepts the residual risk with mitigations.", no_action: "Record why nothing needs to change.", opportunity: "Coordinate joint works under a lead agency.",
  } as Record<string, string>,
  amStatus: { draft: "Draft", pending_approval: "Pending approval", approved: "Approved", rejected: "Rejected", applied: "Applied", cancelled: "Cancelled", stale: "Stale" } as Record<string, string>,
  steps: { agency_admin: "Agency approval", party_confirmation: "Party confirmation", national: "National approval", national_second: "Second national approval" } as Record<string, string>,
  stepStatus: { pending: "Pending", approved: "Approved", rejected: "Rejected", skipped: "Skipped" } as Record<string, string>,
  rail: "Resolution progress", railStep: "Step {n} of {t}: {label}", railOff: "Cancelled",
  hours: { day: "Day", night: "Night", "24h": "24 hours" } as Record<string, string>,
  noAction: { false_positive_geometry: "False positive geometry", different_depth_levels: "Different depth levels", already_coordinated_offline: "Already coordinated offline", works_completed_or_withdrawn: "Works completed or withdrawn", other: "Other" } as Record<string, string>,
  mitigations: { traffic_management_plan: "Traffic management plan", night_work_only: "Night work only", flagger_deployment: "Flagger deployment", public_notice: "Public notice", enhanced_supervision: "Enhanced supervision", utility_locating_survey: "Utility locating survey", daily_coordination_call: "Daily coordination call", other: "Other" } as Record<string, string>,
  commit: { pending: "Pending", done: "Done", waived: "Waived" } as Record<string, string>,
  verify: { pending: "Verification pending", cleared: "Conflict cleared", reduced: "Risk reduced", unchanged: "Unchanged", worse: "Risk worse", delayed: "Verification delayed" } as Record<string, string>,
  outcome: { amendment_cleared: "Cleared by amendment", risk_accepted: "Risk accepted", no_action: "No action", opportunity_realized: "Opportunity realized", directive_cleared: "Cleared by directive" } as Record<string, string>,
  checks: { passed: "Passed", failed: "Failed" },
  sec: { plan: "Plan", amendments: "Amendments", approvals: "Approvals", commitments: "Commitments", verification: "Verification", outcome: "Outcome", past: "Earlier resolutions", impact: "Impact on other works" },
  f: {
    initiator: "Started by {agency}", onBehalf: "on behalf", contested: "Contested", contestedBody: "An agency contested this directive.", shift: "{n} days", shiftNone: "No date change", from: "From", to: "To",
    dueIn: "Due {when}", overdue: "Overdue", solo: "Solo approval", noSecond: "No second admin available", byMe: "You", impactLine: "New conflicts {n} · Worsened {w} · Cleared {c}", impactNone: "Impact not available.",
    justification: "Justification", note: "Note", reason: "Reason", mitigations: "Mitigations", deadline: "Deadline", band: "Accepted band {band} (score {score})", lead: "Lead agency", noneYet: "Nothing here yet.",
    requested: "Requested", assessed: "Assessed", resolvedAt: "Resolved", closedAt: "Closed", noPast: "No earlier resolutions.", noApprovals: "No approvals required yet.", noCommitments: "No commitments.", noAmendments: "No amendments.",
    readOnlyClosed: "This resolution is closed and read-only.", notParty: "You can see status and dates only. Details are shared with the parties.", conflictNo: "Conflict", openConflict: "Open conflict",
  },
  actions: {
    start: "Start resolution", cancel: "Cancel resolution", reassess: "Re-assess now", contest: "Contest directive", confirm: "Confirm as party", approve: "Approve", reject: "Reject",
    submitAm: "Submit for approval", applyAm: "Apply changes", cancelAm: "Cancel amendment", preflight: "Pre-flight check", complete: "Mark done", waive: "Waive", reopen: "Re-open resolved record",
    addAmendment: "Add amendment", acceptRisk: "Accept residual risk",
  } as Record<string, string>,
  actionNote: { add_amendment: "To add an amendment, start a new resolution after cancelling this one.", accept_residual_risk: "Start a risk-acceptance resolution from the Start tab." },
  dlg: { cancelTitle: "Cancel this resolution?", rejectTitle: "Reject this step", contestTitle: "Contest this directive", reopenTitle: "Re-open this resolved record", reasonLabel: "Reason (min {n} characters)", noteLabel: "Note (optional)", rejectNote: "Reason for rejection (min {n} characters)", waiveTitle: "Waive commitment", confirmApprove: "Approve this step?", confirmParty: "Confirm that your agency accepts these changes?" },
  start: {
    title: "Start a resolution", pick: "Choose a path", unavailable: "No resolution path is available to you for this record.", closedRecord: "This record is not open, so a resolution cannot be started.",
    agreed: "Use agreed terms", agreedHelp: "Builds the amendment from agreement {no}.", manual: "Manual schedule change", target: "Work request to change", newStart: "New start", newEnd: "New end", hoursLabel: "Working hours", keepHours: "Keep current",
    preview: "Preview impact", previewing: "Calculating…", previewTitle: "Preview (not saved)", combined: "Combined effect on other works", create: "Create resolution", why: "Reason code", mitigationsPick: "Mitigations (at least one)", mitigationText: "Detail (optional)",
    directiveDays: "Deadline (default {d} days, max {m})", leadAgency: "Lead agency id (optional)", datesInvalid: "End must be after start.", justificationShort: "Justification must be at least {n} characters.", needChange: "Set new dates or working hours.", needMitigation: "Select at least one mitigation.",
    behalfNote: "Acting on behalf of an agency needs a reason, recorded in the audit trail.",
  },
  approvals: {
    title: "Approvals", subtitle: "Steps waiting on you or your agency.", tabs: { mine: "Assigned to me", submitted: "Submitted by me", all: "All involving me" }, overdueOnly: "Overdue only", step: "Step", allSteps: "All steps",
    empty: "Nothing waiting on you.", emptyOther: "No items in this view.", summary: "{p} pending · {o} overdue", fourEyes: "You submitted this, so another approver must decide.", open: "Open", total: "{n} items", prev: "Previous", next: "Next", nav: "Approvals",
  },
  history: {
    title: "Coordination history", subtitle: "A chronological, tamper-evident record of what happened on this conflict.", cat: { record: "Record", coordination: "Coordination", resolution: "Resolution", approval: "Approval", system: "System" } as Record<string, string>,
    all: "All activity", search: "Search action", from: "From", to: "To", clear: "Clear filters", loadMore: "Load more", empty: "No history entries match.", emptyAll: "No history recorded yet.", preLedger: "Before the ledger started", hidden: "{n} entries are not visible to your agency.",
    verify: "Verify integrity", verifying: "Verifying…", verifyOk: "Chain verified: {n} entries, head {head}.", verifyBad: "Integrity check failed at entry {seq}.", notice: "Tamper-evident, not tamper-proof.", csv: "Export CSV", pack: "Export evidence pack",
    seq: "Entry {n}", hash: "Hash", prev: "Previous hash", stateAfter: "State after", rec: "Record", coord: "Coordination", res: "Resolution", sev: "Severity", actor: "Actor", system: "System", agency: "Agency", at: "Time (Asia/Colombo)", recorded: "Recorded at", showMore: "Details", showLess: "Hide",
    total: "{n} entries", asOf: "Audit information is read-only.", integrity: "Ledger: {n} entries · head {head}", noHead: "no head yet",
    action: {
      ledger_started: "Ledger started", record_detected: "Conflict detected", severity_changed: "Severity changed", agency_added: "Agency added", agency_removed: "Agency removed", agency_excluded: "Agency excluded", agency_restored: "Agency restored", acknowledged: "Acknowledged", lead_set: "Lead agency set",
      dismissed: "Dismissed", reopened: "Re-opened", auto_closed: "Auto-closed", redetected: "Re-detected", coordination_created: "Coordination requested", coordination_response: "Response recorded", coordination_counter: "Counter-proposal", coordination_conditions_confirmed: "Conditions confirmed",
      coordination_agreed: "Agreement reached", coordination_closed_no_agreement: "Closed without agreement", coordination_withdrawn: "Request withdrawn", coordination_escalated: "Escalated", coordination_deescalated: "De-escalated", coordination_nudged: "Nudged", deadline_extended: "Deadline extended",
      resolution_started: "Resolution started", amendment_created: "Amendment created", amendment_submitted: "Amendment submitted", approval_granted: "Approval granted", approval_rejected: "Approval rejected", amendment_applied: "Amendment applied", amendment_stale: "Amendment went stale",
      amendment_cancelled: "Amendment cancelled", directive_issued: "Directive issued", directive_contested: "Directive contested", commitment_done: "Commitment done", commitment_waived: "Commitment waived", verification_completed: "Verification completed", resolution_resolved: "Resolution resolved",
      resolution_followup: "Follow-up needed", resolution_cancelled: "Resolution cancelled", risk_accepted: "Risk accepted", risk_reopened: "Risk re-opened", note_added: "Note added", export_generated: "Export generated", integrity_verified: "Integrity verified",
    } as Record<string, string>,
  },
  roles: { SUPER_ADMIN: "National administrator", GOV_ADMIN: "Government administrator", AGENCY_OFFICER: "Agency officer", PROJECT_MANAGER: "Project manager", CONTRACTOR: "Contractor", INSPECTOR: "Inspector", CITIZEN: "Citizen" } as Record<string, string>,
  archive: {
    title: "Resolution archive", subtitle: "Closed conflicts and how they ended.", outcome: "Outcome", empty: "No closed records match.", csv: "Export CSV", days: "{n} d", duration: "Duration", severity: "Severity", detection: "At detection", resolution: "At resolution", amendments: "Amendments applied", commitments: "Open commitments",
    tiles: { resolved: "Resolved", riskAccepted: "Risk accepted", noAction: "No action" } as Record<string, string>, allOutcomes: "All outcomes", closed: "Closed", nav: "History",
  },
  audit: {
    tab: "Audit", archiveTab: "Archive", title: "National audit", subtitle: "Every ledger entry across all conflicts. National staff only.", search: "Search action", empty: "No entries match.", total: "{n} entries",
    verifyPage: "Verify chains on this page", verifying: "Verifying…", intact: "Intact", broken: "Broken at entry {seq}", missing: "Not found", system: "System", open: "Open history",
    note: "Verification checks the hash chain. It is tamper-evident, not tamper-proof.",
  },
};
export type ResolutionCopy = typeof EN;

type Patch = { [K in keyof ResolutionCopy]?: Partial<ResolutionCopy[K]> };
const merge = (p: Patch): ResolutionCopy => Object.fromEntries(Object.entries(EN).map(([k, v]) => [k, typeof v === "object" ? { ...v, ...((p as Record<string, object>)[k] ?? {}) } : (p as Record<string, unknown>)[k] ?? v])) as ResolutionCopy;

const SI = merge({
  status: { draft: "කෙටුම්පත", pending_approval: "අනුමැතිය බලාපොරොත්තුවෙන්", approved: "අනුමත", applying: "වෙනස්කම් යොදමින්", verifying: "සත්‍යාපනය", resolved: "විසඳා ඇත", needs_followup: "පසු විපරම අවශ්‍යයි", cancelled: "අවලංගු" },
  types: { amendment: "කාලසටහන් සංශෝධනය", directive: "ජාතික නිර්දේශය", risk_acceptance: "අවදානම පිළිගැනීම", no_action: "ක්‍රියාමාර්ගයක් අවශ්‍ය නැත", opportunity: "එක් වරක් කැණීමේ අවස්ථාව" },
  actions: { start: "විසඳුම ආරම්භ කරන්න", cancel: "විසඳුම අවලංගු කරන්න", approve: "අනුමත කරන්න", reject: "ප්‍රතික්ෂේප කරන්න", confirm: "පාර්ශ්වයක් ලෙස තහවුරු කරන්න", reassess: "දැන් නැවත ඇගයීම", contest: "නිර්දේශය අභියෝග කරන්න", complete: "සම්පූර්ණයි", waive: "අත්හරින්න" },
  history: { system: "පද්ධතිය", actor: "පරිශීලකයා", title: "සම්බන්ධීකරණ ඉතිහාසය", verify: "අඛණ්ඩතාව සත්‍යාපනය", csv: "CSV අපනයනය", loadMore: "තව පූරණය කරන්න" },
  approvals: { title: "අනුමැතීන්", nav: "අනුමැතීන්" },
  sec: { plan: "සැලැස්ම", amendments: "සංශෝධන", approvals: "අනුමැතීන්", commitments: "බැඳීම්", verification: "සත්‍යාපනය", outcome: "ප්‍රතිඵලය" },
  archive: { title: "විසඳුම් ලේඛනාගාරය", nav: "ඉතිහාසය" },
  roles: { SUPER_ADMIN: "ජාතික පරිපාලක", GOV_ADMIN: "රාජ්‍ය පරිපාලක", AGENCY_OFFICER: "ආයතන නිලධාරියා", PROJECT_MANAGER: "ව්‍යාපෘති කළමනාකරු", CONTRACTOR: "කොන්ත්‍රාත්කරු", INSPECTOR: "පරීක්ෂක", CITIZEN: "පුරවැසියා" },
  audit: { tab: "විගණනය", archiveTab: "ලේඛනාගාරය", title: "ජාතික විගණනය", system: "පද්ධතිය" },
  loading: "පූරණය වෙමින්…", tab: "විසඳුම", historyTab: "ඉතිහාසය",
});
const TA = merge({
  status: { draft: "வரைவு", pending_approval: "ஒப்புதல் நிலுவையில்", approved: "அங்கீகரிக்கப்பட்டது", applying: "மாற்றங்கள் செயல்படுத்தப்படுகின்றன", verifying: "சரிபார்ப்பு", resolved: "தீர்க்கப்பட்டது", needs_followup: "தொடர் நடவடிக்கை தேவை", cancelled: "ரத்து" },
  types: { amendment: "அட்டவணை திருத்தம்", directive: "தேசிய உத்தரவு", risk_acceptance: "ஆபத்து ஏற்பு", no_action: "நடவடிக்கை தேவையில்லை", opportunity: "ஒருமுறை தோண்டும் வாய்ப்பு" },
  actions: { start: "தீர்வைத் தொடங்கு", cancel: "தீர்வை ரத்து செய்", approve: "அங்கீகரி", reject: "நிராகரி", confirm: "தரப்பாக உறுதிப்படுத்து", reassess: "இப்போது மறுமதிப்பீடு", contest: "உத்தரவை எதிர்", complete: "முடிந்தது", waive: "தள்ளுபடி" },
  history: { system: "அமைப்பு", actor: "பயனர்", title: "ஒருங்கிணைப்பு வரலாறு", verify: "ஒருமைப்பாட்டைச் சரிபார்", csv: "CSV ஏற்றுமதி", loadMore: "மேலும் ஏற்று" },
  approvals: { title: "ஒப்புதல்கள்", nav: "ஒப்புதல்கள்" },
  sec: { plan: "திட்டம்", amendments: "திருத்தங்கள்", approvals: "ஒப்புதல்கள்", commitments: "உறுதிமொழிகள்", verification: "சரிபார்ப்பு", outcome: "முடிவு" },
  archive: { title: "தீர்வு காப்பகம்", nav: "வரலாறு" },
  roles: { SUPER_ADMIN: "தேசிய நிர்வாகி", GOV_ADMIN: "அரசு நிர்வாகி", AGENCY_OFFICER: "நிறுவன அலுவலர்", PROJECT_MANAGER: "திட்ட மேலாளர்", CONTRACTOR: "ஒப்பந்ததாரர்", INSPECTOR: "ஆய்வாளர்", CITIZEN: "குடிமகன்" },
  audit: { tab: "தணிக்கை", archiveTab: "காப்பகம்", title: "தேசிய தணிக்கை", system: "அமைப்பு" },
  loading: "ஏற்றுகிறது…", tab: "தீர்வு", historyTab: "வரலாறு",
});

export function getResolutionCopy(locale: AuthLocale): ResolutionCopy {
  return locale === "si" ? SI : locale === "ta" ? TA : EN;
}

/** Role label in the viewer's language; an unknown key reads as plain words, never the raw code. */
export function roleLabel(copy: ResolutionCopy, role: string): string {
  const known = copy.roles[role];
  if (known) return known;
  const words = role.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Ledger action label with a readable fallback for codes added later on the server. */
export function actionLabel(copy: ResolutionCopy, code: string): string {
  return copy.history.action[code] ?? code.replace(/_/g, " ");
}
