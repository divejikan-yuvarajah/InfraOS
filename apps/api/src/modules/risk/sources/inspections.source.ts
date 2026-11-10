import mongoose, { type ClientSession } from "mongoose";
import { Inspection } from "../../inspections/models/inspection.model.js";
import { calendarDaysBetween, colomboDayStart } from "../engine/math.js";
import type { InspectionsInputData, SourceEnvelope } from "../engine/types.js";

export async function fetchInspectionsSource(
  projectId: string,
  now: Date,
  session?: ClientSession,
): Promise<SourceEnvelope<InspectionsInputData>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
      data: {
        scheduledOverdueCount: 0,
        oldestScheduledOverdueDays: 0,
        openCriticalDefectsCount: 0,
        oldestCriticalDefectDays: 0,
        openMajorDefectsCount: 0,
        oldestMajorDefectDays: 0,
        verificationsAwaitingReviewCount: 0,
        oldestVerificationAwaitingDays: 0,
        totalCompletedInspectionsCount: 0,
      },
    };
  }

  const objId = new mongoose.Types.ObjectId(projectId);
  const today = colomboDayStart(now);

  const inspections = await Inspection.find({ projectId: objId })
    .sort({ inspectionDate: -1 })
    .session(session ?? null)
    .lean();

  let scheduledOverdueCount = 0;
  let oldestScheduledOverdueDays = 0;
  let totalCompletedInspectionsCount = 0;
  let verificationsAwaitingReviewCount = 0;
  let oldestVerificationAwaitingDays = 0;

  // Track resolved defect keys from followUpChecks
  const resolvedDefectKeys = new Set<string>();
  for (const ins of inspections) {
    for (const fc of ins.report?.followUpChecks ?? []) {
      if (fc.resolved && fc.defectKey) {
        resolvedDefectKeys.add(fc.defectKey);
      }
    }
  }

  let openCriticalDefectsCount = 0;
  let oldestCriticalDefectDays = 0;
  let openMajorDefectsCount = 0;
  let oldestMajorDefectDays = 0;

  for (const ins of inspections) {
    const insDate = ins.inspectionDate ? new Date(ins.inspectionDate) : new Date(ins.createdAt ?? now);
    const daysSinceInspection = Math.max(0, calendarDaysBetween(insDate, today));

    // Scheduled overdue
    if (ins.status === "SCHEDULED" && insDate.getTime() < today.getTime()) {
      scheduledOverdueCount++;
      if (daysSinceInspection > oldestScheduledOverdueDays) {
        oldestScheduledOverdueDays = daysSinceInspection;
      }
    }

    // Completed / Verified inspections
    if (ins.status === "VERIFIED") {
      totalCompletedInspectionsCount++;
    }

    // Awaiting review
    if (ins.status === "SUBMITTED") {
      verificationsAwaitingReviewCount++;
      const subDate = ins.submittedAt ? new Date(ins.submittedAt) : insDate;
      const days = Math.max(0, calendarDaysBetween(subDate, today));
      if (days > oldestVerificationAwaitingDays) {
        oldestVerificationAwaitingDays = days;
      }
    }

    // Defects from report
    for (const defect of ins.report?.defects ?? []) {
      if (defect.key && !resolvedDefectKeys.has(defect.key)) {
        if (defect.severity === "CRITICAL") {
          openCriticalDefectsCount++;
          if (daysSinceInspection > oldestCriticalDefectDays) {
            oldestCriticalDefectDays = daysSinceInspection;
          }
        } else if (defect.severity === "MAJOR") {
          openMajorDefectsCount++;
          if (daysSinceInspection > oldestMajorDefectDays) {
            oldestMajorDefectDays = daysSinceInspection;
          }
        }
      }
    }
  }

  const latestAsOf = inspections[0]?.updatedAt
    ? new Date(inspections[0].updatedAt)
    : inspections[0]?.inspectionDate
      ? new Date(inspections[0].inspectionDate)
      : null;

  return {
    available: true,
    asOf: latestAsOf,
    data: {
      scheduledOverdueCount,
      oldestScheduledOverdueDays,
      openCriticalDefectsCount,
      oldestCriticalDefectDays,
      openMajorDefectsCount,
      oldestMajorDefectDays,
      verificationsAwaitingReviewCount,
      oldestVerificationAwaitingDays,
      totalCompletedInspectionsCount,
    },
  };
}
