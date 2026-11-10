import mongoose, { type ClientSession } from "mongoose";
import { Milestone } from "../../projects/models/milestone.model.js";
import type { MilestoneInputItem, SourceEnvelope } from "../engine/types.js";

export async function fetchMilestonesSource(
  projectId: string,
  session?: ClientSession,
): Promise<SourceEnvelope<MilestoneInputItem[]>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
      data: [],
    };
  }

  const query = Milestone.find({ projectId: new mongoose.Types.ObjectId(projectId) })
    .sort({ plannedStart: 1 })
    .limit(200)
    .session(session ?? null);

  const rows = await query.lean();

  if (!rows || rows.length === 0) {
    return {
      available: true,
      asOf: null,
      reasonKey: "no_milestones_recorded",
      data: [],
    };
  }

  let latestUpdate: Date = new Date(0);
  const data: MilestoneInputItem[] = rows.map((row) => {
    const updatedAt = row.updatedAt ? new Date(row.updatedAt) : new Date(0);
    if (updatedAt > latestUpdate) latestUpdate = updatedAt;

    return {
      id: row._id.toString(),
      title: row.title,
      status: row.status,
      progress: row.progress,
      plannedStart: row.plannedStart ? new Date(row.plannedStart) : null,
      plannedEnd: row.plannedEnd ? new Date(row.plannedEnd) : null,
      actualStart: row.actualStart ? new Date(row.actualStart) : null,
      actualEnd: row.actualEnd ? new Date(row.actualEnd) : null,
    };
  });

  return {
    available: true,
    asOf: latestUpdate.getTime() > 0 ? latestUpdate : new Date(),
    data,
  };
}

