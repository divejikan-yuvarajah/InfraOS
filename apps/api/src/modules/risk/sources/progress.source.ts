import mongoose, { type ClientSession } from "mongoose";
import { ProgressReport } from "../../projects/models/progress-report.model.js";
import type { ProgressReportInputItem, SourceEnvelope } from "../engine/types.js";

export async function fetchProgressSource(
  projectId: string,
  session?: ClientSession,
): Promise<SourceEnvelope<ProgressReportInputItem[]>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
      data: [],
    };
  }

  // Load last 12 progress reports sorted descending by sequence / reportedAt
  const query = ProgressReport.find({ projectId: new mongoose.Types.ObjectId(projectId) })
    .sort({ reportedAt: -1 })
    .limit(12)
    .session(session ?? null);

  const rows = await query.lean();

  if (!rows || rows.length === 0) {
    return {
      available: true,
      asOf: null,
      reasonKey: "no_progress_reports_submitted",
      data: [],
    };
  }

  const latestReportedAt = rows[0]?.reportedAt ? new Date(rows[0].reportedAt) : null;

  const data: ProgressReportInputItem[] = rows.map((row) => ({
    id: row._id.toString(),
    reportedPercent: row.reportedPercent,
    previousPercent: row.previousPercent,
    reportedAt: new Date(row.reportedAt),
    sequence: row.sequence,
  }));

  return {
    available: true,
    asOf: latestReportedAt,
    data,
  };
}

