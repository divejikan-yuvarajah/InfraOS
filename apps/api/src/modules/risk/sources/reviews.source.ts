import mongoose, { type ClientSession } from "mongoose";
import { Project } from "../../projects/models/project.model.js";
import { calendarDaysBetween, colomboDayStart } from "../engine/math.js";
import type { ProjectReviewsInputData, SourceEnvelope } from "../engine/types.js";

export async function fetchReviewsSource(
  projectId: string,
  now: Date,
  session?: ClientSession,
): Promise<SourceEnvelope<ProjectReviewsInputData>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
      data: { pendingReviewsCount: 0, oldestPendingDays: 0, items: [] },
    };
  }

  const project = await Project.findById(projectId)
    .select("status updatedAt createdAt")
    .session(session ?? null)
    .lean();

  if (!project) {
    return {
      available: false,
      asOf: null,
      reasonKey: "project_not_found",
      data: { pendingReviewsCount: 0, oldestPendingDays: 0, items: [] },
    };
  }

  const today = colomboDayStart(now);
  const items: Array<{
    id: string;
    type: string;
    submittedAt: Date;
    daysPending: number;
  }> = [];

  if (project.status === "SUBMITTED" || project.status === "UNDER_REVIEW") {
    const submittedAt = project.updatedAt ? new Date(project.updatedAt) : new Date(project.createdAt ?? now);
    const daysPending = Math.max(0, calendarDaysBetween(submittedAt, today));
    items.push({
      id: project._id.toString(),
      type: `PROJECT_${project.status}`,
      submittedAt,
      daysPending,
    });
  }

  const oldestPendingDays = items.reduce((max, i) => Math.max(max, i.daysPending), 0);

  return {
    available: true,
    asOf: project.updatedAt ? new Date(project.updatedAt) : new Date(),
    data: {
      pendingReviewsCount: items.length,
      oldestPendingDays,
      items,
    },
  };
}
