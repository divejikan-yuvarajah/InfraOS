import mongoose, { type ClientSession } from "mongoose";
import { ConflictRecord } from "../../roadsync/models/conflict-record.model.js";
import { calendarDaysBetween, colomboDayStart } from "../engine/math.js";
import type {
  RoadsyncConflictInputItem,
  RoadsyncInputData,
  SourceEnvelope,
} from "../engine/types.js";

export async function fetchRoadsyncSource(
  projectId: string,
  now: Date,
  session?: ClientSession,
): Promise<SourceEnvelope<RoadsyncInputData>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
      data: {
        conflicts: [],
        unacknowledgedCoordinationCount: 0,
        oldestUnacknowledgedDays: 0,
        overdueCommitmentsCount: 0,
        oldestOverdueCommitmentDays: 0,
      },
    };
  }

  const objId = new mongoose.Types.ObjectId(projectId);
  const today = colomboDayStart(now);

  try {
    const conflictsQuery = ConflictRecord.find({
      $or: [
        { aId: objId, aType: "project" },
        { bId: objId, bType: "project" },
      ],
      status: { $in: ["open", "in_coordination"] },
    })
      .session(session ?? null)
      .lean();

    const records = await conflictsQuery;

    let unacknowledgedCoordinationCount = 0;
    let oldestUnacknowledgedDays = 0;
    let overdueCommitmentsCount = 0;
    let oldestOverdueCommitmentDays = 0;

    const conflicts: RoadsyncConflictInputItem[] = [];

    for (const rec of records) {
      const createdAt = rec.createdAt ? new Date(rec.createdAt) : today;
      const openDays = Math.max(0, calendarDaysBetween(createdAt, today));

      const rawBand = (
        (rec.severity as any)?.current?.band ??
        (rec.severity as any)?.band ??
        "LOW"
      ).toUpperCase();

      let severityBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
      if (rawBand === "CRITICAL") severityBand = "CRITICAL";
      else if (rawBand === "HIGH") severityBand = "HIGH";
      else if (rawBand === "MEDIUM" || rawBand === "MODERATE") severityBand = "MEDIUM";
      else severityBand = "LOW";

      const affectedAgencies = Array.isArray(rec.affectedAgencies) ? rec.affectedAgencies : [];
      const affectedAgencyCount = affectedAgencies.length || (Array.isArray(rec.agencyIds) ? rec.agencyIds.length : 1);

      // Check unacknowledged agencies
      for (const ag of affectedAgencies) {
        if (ag?.ack?.status === "unacknowledged" || ag?.status === "pending") {
          unacknowledgedCoordinationCount++;
          if (openDays > oldestUnacknowledgedDays) {
            oldestUnacknowledgedDays = openDays;
          }
        }
      }

      // Check resolution open commitments
      const res = rec.resolution as any;
      if (res?.openCommitments && typeof res.openCommitments === "number" && res.openCommitments > 0) {
        overdueCommitmentsCount += res.openCommitments;
        if (openDays > oldestOverdueCommitmentDays) {
          oldestOverdueCommitmentDays = openDays;
        }
      }

      conflicts.push({
        conflictId: rec._id.toString(),
        conflictNo: rec.conflictNo,
        severityBand,
        status: rec.status,
        openDays,
        affectedAgencyCount,
        coordinationStatus: (rec.coordination as any)?.state ?? null,
        openCommitmentsCount: res?.openCommitments ?? 0,
      });
    }

    return {
      available: true,
      asOf: records[0]?.updatedAt ? new Date(records[0].updatedAt) : new Date(),
      data: {
        conflicts,
        unacknowledgedCoordinationCount,
        oldestUnacknowledgedDays,
        overdueCommitmentsCount,
        oldestOverdueCommitmentDays,
      },
    };
  } catch (_err) {
    return {
      available: false,
      asOf: null,
      reasonKey: "roadsync_service_unavailable",
      data: {
        conflicts: [],
        unacknowledgedCoordinationCount: 0,
        oldestUnacknowledgedDays: 0,
        overdueCommitmentsCount: 0,
        oldestOverdueCommitmentDays: 0,
      },
    };
  }
}

