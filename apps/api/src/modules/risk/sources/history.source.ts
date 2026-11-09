import mongoose, { type ClientSession } from "mongoose";
import { Project } from "../../projects/models/project.model.js";
import { calendarDaysBetween } from "../engine/math.js";
import type { HistoryInputData, SourceEnvelope } from "../engine/types.js";

export async function fetchHistorySource(
  projectType: string,
  agencyId: string,
  session?: ClientSession,
): Promise<SourceEnvelope<HistoryInputData>> {
  if (!projectType || !agencyId || !mongoose.Types.ObjectId.isValid(agencyId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "missing_type_or_agency",
      data: {
        comparableCount: 0,
        medianDurationOverrunRatio: 1.0,
      },
    };
  }

  // Find comparable completed projects of the same projectType and agencyId
  const query = Project.find({
    projectType,
    agencyId: new mongoose.Types.ObjectId(agencyId),
    status: "COMPLETED",
    startDate: { $exists: true, $ne: null },
    plannedEndDate: { $exists: true, $ne: null },
    actualEndDate: { $exists: true, $ne: null },
  })
    .select("startDate plannedEndDate actualEndDate")
    .limit(100)
    .session(session ?? null)
    .lean();

  const completed = await query;

  if (!completed || completed.length === 0) {
    return {
      available: true,
      asOf: new Date(),
      data: {
        comparableCount: 0,
        medianDurationOverrunRatio: 1.0,
      },
    };
  }

  const ratios: number[] = [];
  for (const p of completed) {
    if (p.startDate && p.plannedEndDate && p.actualEndDate) {
      const plannedDuration = calendarDaysBetween(
        new Date(p.startDate),
        new Date(p.plannedEndDate),
      );
      const actualDuration = calendarDaysBetween(
        new Date(p.startDate),
        new Date(p.actualEndDate),
      );
      if (plannedDuration > 0) {
        const ratio = Math.max(0.5, actualDuration / plannedDuration);
        ratios.push(ratio);
      }
    }
  }

  if (ratios.length === 0) {
    return {
      available: true,
      asOf: new Date(),
      data: {
        comparableCount: 0,
        medianDurationOverrunRatio: 1.0,
      },
    };
  }

  // Calculate median
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median =
    ratios.length % 2 !== 0
      ? ratios[mid]!
      : (ratios[mid - 1]! + ratios[mid]!) / 2;

  return {
    available: true,
    asOf: new Date(),
    data: {
      comparableCount: ratios.length,
      medianDurationOverrunRatio: Math.round(median * 100) / 100,
    },
  };
}
