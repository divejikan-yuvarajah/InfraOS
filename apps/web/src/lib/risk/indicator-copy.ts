import type { AuthLocale } from "@/lib/auth/types";
import type { RiskIndicatorDto } from "./types";

export interface IndicatorCopyItem {
  title: string;
  explanation: (inputs: Record<string, any>) => string;
}

export const INDICATOR_CATALOG_EN: Record<string, IndicatorCopyItem> = {
  DL1: {
    title: "Project Past Planned End Date",
    explanation: (i) =>
      `Project is ${i.overdueDays ?? 0} calendar days past its planned completion date (${i.plannedEndDate ?? "N/A"}). Current physical progress is ${i.physicalProgress ?? 0}%.`,
  },
  DL2: {
    title: "Schedule Slippage vs Elapsed Duration",
    explanation: (i) =>
      `Duration elapsed is ${i.elapsedPercent ?? 0}% (${i.elapsedDays ?? 0} of ${i.totalDays ?? 0} days), but physical progress is only ${i.physicalProgress ?? 0}%, reflecting a ${i.slippagePoints ?? 0} percentage-point slippage.`,
  },
  DL3: {
    title: "Critical Overdue Milestones",
    explanation: (i) =>
      `${i.count ?? 0} milestone(s) are overdue. Oldest milestone "${i.oldestMilestoneTitle ?? ""}" is overdue by ${i.maxOverdueDays ?? 0} days with ${i.progress ?? 0}% completed.`,
  },
  DL4: {
    title: "Historical Contractor Delay Track Record",
    explanation: (i) =>
      `Assigned contractor "${i.contractorName ?? "Contractor"}" experienced delays in ${i.delayedCount ?? 0} of ${i.priorProjectsCount ?? 0} prior completed projects (${i.delayRatePercent ?? 0}% delay rate, avg delay ${i.avgDelayDays ?? 0} days).`,
  },
  DL5: {
    title: "Similar Projects Duration Exceedance",
    explanation: (i) =>
      `Comparable ${i.projectType ?? ""} projects in ${i.province ?? "the province"} averaged ${i.medianDurationDays ?? 0} days to complete. Current planned duration of ${i.plannedDays ?? 0} days exceeds this baseline by ${i.exceedPercent ?? 0}%.`,
  },
  PG1: {
    title: "Stagnant or Missing Progress Reporting",
    explanation: (i) =>
      i.reason === "no_reports"
        ? `No site progress reports have been submitted for ${i.activeDays ?? 0} days since project start.`
        : `Physical progress has remained unchanged at ${i.currentPercent ?? 0}% across ${i.reportCount ?? 0} reports over the last ${i.stagnantDays ?? 0} days.`,
  },
  PG2: {
    title: "Physical Progress Divergence",
    explanation: (i) =>
      `Contractor reported ${i.reportedPercent ?? 0}% physical progress, but independent engineer inspection verified only ${i.verifiedPercent ?? 0}% (${i.gapPoints ?? 0} percentage-point gap).`,
  },
  PG3: {
    title: "Suspicious Linear Progress Without Evidence",
    explanation: (i) =>
      `Progress advanced by an identical +${i.deltaPercent ?? 0}% per report across ${i.consecutiveCount ?? 0} consecutive submissions without supporting site inspection records.`,
  },
  BG1: {
    title: "Recorded Spend Exceeds Approved Budget",
    explanation: (i) =>
      `Verified expenditure is ${i.ratioPercent ?? 0}% of the approved budget (${i.costGrowthPercent ?? 0}% budget cost overrun).`,
  },
  BG2: {
    title: "High Committed Spend Exposure",
    explanation: (i) =>
      `Total contractual commitments plus disbursements reach ${i.committedRatioPercent ?? 0}% of the allocated budget.`,
  },
  BG3: {
    title: "Financial Ahead of Physical Progress",
    explanation: (i) =>
      `Financial disbursement (${i.financialPercent ?? 0}%) leads physical site progress (${i.physicalProgress ?? 0}%) by ${i.gapPoints ?? 0} percentage points.`,
  },
  BG4: {
    title: "Repeated Budget Cost Revisions",
    explanation: (i) =>
      `Project budget has undergone ${i.revisionCount ?? 0} revisions, escalating total allocation by ${i.increasePercent ?? 0}%.`,
  },
  BG5: {
    title: "Recent Spending Burn Rate Acceleration",
    explanation: (i) =>
      `Recent 30-day spend is ${i.burnRateMultiple ?? 0}x the historical monthly burn rate (${i.monthlyAvgMinor ? "accelerated cash burn" : "spike detected"}).`,
  },
  BG6: {
    title: "Estimate at Completion (EAC) Forecast Overrun",
    explanation: (i) =>
      `Projected completion cost based on verified burn efficiency indicates an anticipated ${i.eacOverrunPercent ?? 0}% budget overrun.`,
  },
  SC1: {
    title: "Prerequisite Project Schedule Conflict",
    explanation: (i) =>
      `Project planned start precedes the completion date of required prerequisite project "${i.prerequisiteCode ?? ""}".`,
  },
  SC2: {
    title: "Pending Statutory Approval Overdue",
    explanation: (i) =>
      `Statutory agency approval has been pending for ${i.pendingDays ?? 0} days, exceeding the 30-day standard SLA.`,
  },
  SC3: {
    title: "No Independent Site Inspections Recorded",
    explanation: (i) =>
      `Project has been active for ${i.activeDays ?? 0} days without an independent site verification inspection.`,
  },
  CO1: {
    title: "Unresolved RoadSync Corridor Conflict",
    explanation: (i) =>
      `Active RoadSync conflict ${i.conflictNo ?? ""} with ${i.affectedAgencyCount ?? 2} utility agencies has remained open for ${i.openDays ?? 0} days.`,
  },
  CO2: {
    title: "Unacknowledged Multi-Agency Coordination",
    explanation: (i) =>
      `Utility coordination notice ${i.coordinationNo ?? ""} has remained unacknowledged for ${i.unacknowledgedDays ?? 0} days.`,
  },
  CO3: {
    title: "Contractor Concurrent Workload Stretched",
    explanation: (i) =>
      `Contractor is concurrently executing ${i.concurrentActiveProjects ?? 0} active projects, which may strain site management capacity.`,
  },
};

export const INDICATOR_CATALOG_SI: Record<string, IndicatorCopyItem> = {
  DL1: {
    title: "සැලසුම්ගත අවසන් දිනය ඉක්මවා ඇත",
    explanation: (i) =>
      `ව්‍යාපෘතිය එහි සැලසුම්ගත අවසන් දිනයට (${i.plannedEndDate ?? "N/A"}) වඩා දින ${i.overdueDays ?? 0} ක් ප්‍රමාදයි. වත්මන් භෞතික ප්‍රගතිය ${i.physicalProgress ?? 0}% කි.`,
  },
  DL2: {
    title: "ගතවූ කාලයට සාපේක්ෂව ප්‍රගති ප්‍රමාදය",
    explanation: (i) =>
      `සැලසුම්ගත කාලයෙන් ${i.elapsedPercent ?? 0}% ක් ගතවී ඇතත්, භෞතික ප්‍රගතිය ${i.physicalProgress ?? 0}% ක් පමණක් වන බැවින් ප්‍රතිශත ලකුණු ${i.slippagePoints ?? 0} ක ප්‍රමාදයක් පවතී.`,
  },
  DL3: {
    title: "කල් ඉකුත් වූ සන්ධිස්ථාන",
    explanation: (i) =>
      `සන්ධිස්ථාන ${i.count ?? 0} ක් කල් ඉකුත් වී ඇත. පැරණිතම සන්ධිස්ථානය දින ${i.maxOverdueDays ?? 0} ක් ප්‍රමාද වී ඇත.`,
  },
  BG1: {
    title: "අනුමත අයවැය ඉක්මවා වියදම් කර ඇත",
    explanation: (i) =>
      `තහවුරු කළ වියදම අනුමත අයවැයෙන් ${i.ratioPercent ?? 0}% කි (${i.costGrowthPercent ?? 0}% ක වියදම් වැඩිවීමක්).`,
  },
  BG3: {
    title: "භෞතික ප්‍රගතියට වඩා මූල්‍ය වියදම් ඉදිරියෙන්",
    explanation: (i) =>
      `මූල්‍ය වියදම (${i.financialPercent ?? 0}%) භෞතික වැඩට (${i.physicalProgress ?? 0}%) වඩා ප්‍රතිශත ලකුණු ${i.gapPoints ?? 0} කින් ඉදිරියෙන් ඇත.`,
  },
  CO1: {
    title: "නිරාකරණය නොකළ RoadSync ගැටුම",
    explanation: (i) =>
      `RoadSync ගැටුම ${i.conflictNo ?? ""} ආයතන ${i.affectedAgencyCount ?? 2} ක් සමඟ දින ${i.openDays ?? 0} ක් පුරා විවෘතව පවතී.`,
  },
};

export const INDICATOR_CATALOG_TA: Record<string, IndicatorCopyItem> = {
  DL1: {
    title: "திட்டமிடப்பட்ட இறுதித் தேதியை தாண்டியுள்ளது",
    explanation: (i) =>
      `திட்டம் அதன் திட்டமிடப்பட்ட இறுதித் தேதியை (${i.plannedEndDate ?? "N/A"}) விட ${i.overdueDays ?? 0} நாட்கள் தாமதமாகியுள்ளது. தற்போதைய கள முன்னேற்றம் ${i.physicalProgress ?? 0}%.`,
  },
  DL2: {
    title: "கடந்த காலத்திற்கு ஏற்ப முன்னேற்ற தாமதம்",
    explanation: (i) =>
      `திட்ட காலத்தின் ${i.elapsedPercent ?? 0}% கடந்துவிட்டது, ஆனால் கள முன்னேற்றம் ${i.physicalProgress ?? 0}% மட்டுமே உள்ளது (${i.slippagePoints ?? 0} சதவீத புள்ளி தாமதம்).`,
  },
  DL3: {
    title: "காலாவதியான முக்கிய மைல்கற்கள்",
    explanation: (i) =>
      `${i.count ?? 0} மைல்கற்கள் காலாவதியாகியுள்ளன. மிக பழைய மைல்கல் ${i.maxOverdueDays ?? 0} நாட்கள் தாமதமானது.`,
  },
  BG1: {
    title: "அங்கீகரிக்கப்பட்ட வரவுசெலவை விட கூடுதல் செலவு",
    explanation: (i) =>
      `செலவு அங்கீகரிக்கப்பட்ட வரவுசெலவில் ${i.ratioPercent ?? 0}% ஆகும் (${i.costGrowthPercent ?? 0}% வரவுசெலவு உயர்வு).`,
  },
  BG3: {
    title: "களப் பணியை விட நிதிச் செலவு முன்னிலையில்",
    explanation: (i) =>
      `நிதிச் செலவு (${i.financialPercent ?? 0}%) களப் பணியை (${i.physicalProgress ?? 0}%) விட ${i.gapPoints ?? 0} சதவீத புள்ளிகள் முன்னிலையில் உள்ளது.`,
  },
  CO1: {
    title: "தீர்க்கப்படாத RoadSync முரண்பாடு",
    explanation: (i) =>
      `RoadSync முரண்பாடு ${i.conflictNo ?? ""} ${i.affectedAgencyCount ?? 2} முகமைகளுடன் ${i.openDays ?? 0} நாட்களாக தீர்க்கப்படாமல் உள்ளது.`,
  },
};

export function getIndicatorTitle(
  indicator: Pick<RiskIndicatorDto, "code" | "titleKey">,
  locale: AuthLocale = "en",
): string {
  const catalog =
    locale === "si"
      ? INDICATOR_CATALOG_SI
      : locale === "ta"
        ? INDICATOR_CATALOG_TA
        : INDICATOR_CATALOG_EN;

  if (catalog[indicator.code]?.title) {
    return catalog[indicator.code]!.title;
  }
  return INDICATOR_CATALOG_EN[indicator.code]?.title ?? `Indicator ${indicator.code}`;
}

export function getIndicatorExplanation(
  indicator: Pick<RiskIndicatorDto, "code" | "inputs">,
  locale: AuthLocale = "en",
): string {
  const catalog =
    locale === "si"
      ? INDICATOR_CATALOG_SI
      : locale === "ta"
        ? INDICATOR_CATALOG_TA
        : INDICATOR_CATALOG_EN;

  const item = catalog[indicator.code] ?? INDICATOR_CATALOG_EN[indicator.code];
  if (item && indicator.inputs) {
    try {
      return item.explanation(indicator.inputs);
    } catch {
      // fallback
    }
  }
  return "Threshold trigger recorded by automated risk assessment engine.";
}

export const RECOMMENDATION_COPY: Record<
  string,
  { title: string; body: string; ctaText: string }
> = {
  REVIEW_DELAYED_MILESTONES: {
    title: "Review Milestone Delays & Work Breakdown",
    body: "Overdue milestones are compounding project duration slippage. Convene a site progress meeting to re-baseline tasks or accelerate contractor shifts.",
    ctaText: "Open Milestones Workspace",
  },
  INVESTIGATE_HIGH_SPENDING: {
    title: "Audit Disbursements Against Site Progress",
    body: "Disbursements significantly outpace physical deliverables. Conduct a field audit of bill of quantities (BOQ) and contractor payment claims.",
    ctaText: "Open Finance Workspace",
  },
  REVIEW_BUDGET_COMMITMENTS: {
    title: "Review Contractual Commitments & Variations",
    body: "Total commitments approach statutory budget thresholds. Review pending variation orders and unreleased payment certificates.",
    ctaText: "Review Project Commitments",
  },
  SCHEDULE_INSPECTION: {
    title: "Dispatch Field Inspection Officer",
    body: "No recent independent engineering inspection on file. Schedule a verified site inspection to validate contractor claims.",
    ctaText: "Schedule Site Inspection",
  },
  CLEAR_VERIFICATION_BACKLOG: {
    title: "Reconcile Progress Verification Gap",
    body: "A substantial variance exists between contractor reported progress and verified site measurements. Issue formal reconciliation directive.",
    ctaText: "View Inspection Verification",
  },
  REVIEW_UNRESOLVED_ROADSYNC_CONFLICTS: {
    title: "Convene RoadSync Joint Corridor Arbitration",
    body: "Unresolved utility corridor conflict threatens road opening schedule. Convene inter-agency joint coordination meeting.",
    ctaText: "Open RoadSync Conflicts",
  },
  COORDINATE_WITH_AFFECTED_AGENCIES: {
    title: "Acknowledge Outstanding Utility Coordination",
    body: "Multi-agency coordination notices require formal agency acknowledgement before excavation permits expire.",
    ctaText: "Open Coordination Hub",
  },
  INVESTIGATE_MISSING_EVIDENCE: {
    title: "Require Detailed Progress Submissions",
    body: "Site submissions lack required photo or measurement evidence. Instruct contractor to provide verified site documentation.",
    ctaText: "Open Progress Reports",
  },
  REASSESS_CONTRACTOR_SCHEDULING: {
    title: "Review Contractor Plant & Manpower Allocation",
    body: "Contractor is carrying heavy concurrent project load across the province. Verify dedicated site plant and engineering presence.",
    ctaText: "View Contractor Profile",
  },
  FIX_SCHEDULE_DATA: {
    title: "Resolve Dependency Scheduling Inconsistency",
    body: "Planned start date precedes required predecessor completion. Update timeline schedule dependencies.",
    ctaText: "Update Dependencies",
  },
  EXPEDITE_APPROVALS: {
    title: "Expedite Statutory Agency Clearances",
    body: "Pending regulatory or environmental approvals exceed standard turnaround SLAs. Escalate to agency liaisons.",
    ctaText: "View Approvals Queue",
  },
  ADD_MISSING_DATA: {
    title: "Complete Core Project Baseline Records",
    body: "Missing milestone schedules, financial allocations, or baseline dates prevent comprehensive risk scoring.",
    ctaText: "Edit Project Details",
  },
};
