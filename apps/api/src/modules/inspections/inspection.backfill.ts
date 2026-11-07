import { nextNumber } from "../../shared/database/counter.js";
import { Project } from "../projects/models/project.model.js";
import { Inspection } from "./models/inspection.model.js";

/** Idempotent. Numbers existing inspections and copies the owning agency from the project. Never invents progress, reports or dates. */
export async function backfillInspections(commit: boolean): Promise<{ mode: "dry-run" | "commit"; scanned: number; numbered: number; agencySet: number; defaulted: number }> {
  const rows = await Inspection.find({ $or: [{ inspectionNo: { $exists: false } }, { agencyId: { $exists: false } }, { inspectionType: { $exists: false } }] })
    .select("projectId inspectionNo agencyId inspectionType priority durationMinutes version createdAt").sort({ createdAt: 1 }).lean();
  let numbered = 0, agencySet = 0, defaulted = 0;
  for (const row of rows) {
    const $set: Record<string, unknown> = {};
    if (!row.inspectionNo) { numbered += 1; if (commit) $set.inspectionNo = await nextNumber("INS", row.createdAt ?? new Date()); }
    if (!row.agencyId) {
      const project = await Project.findById(row.projectId).select("agencyId").lean();
      if (project?.agencyId) { agencySet += 1; $set.agencyId = project.agencyId; }
    }
    if (!row.inspectionType) { defaulted += 1; $set.inspectionType = "PROGRESS_VERIFICATION"; }
    if (!row.priority) $set.priority = "NORMAL";
    if (!row.durationMinutes) $set.durationMinutes = 120;
    if (row.version === undefined) $set.version = 0;
    if (commit && Object.keys($set).length) await Inspection.updateOne({ _id: row._id }, { $set }, { timestamps: false });
  }
  return { mode: commit ? "commit" : "dry-run", scanned: rows.length, numbered, agencySet, defaulted };
}
