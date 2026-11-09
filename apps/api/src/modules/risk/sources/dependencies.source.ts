import mongoose, { type ClientSession } from "mongoose";
import { ProjectDependency } from "../../projects/models/project-dependency.model.js";
import { Project } from "../../projects/models/project.model.js";
import type { DependencyInputItem, SourceEnvelope } from "../engine/types.js";

export async function fetchDependenciesSource(
  projectId: string,
  session?: ClientSession,
): Promise<SourceEnvelope<DependencyInputItem[]>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
      data: [],
    };
  }

  const query = ProjectDependency.find({
    projectId: new mongoose.Types.ObjectId(projectId),
    removedAt: null,
  })
    .limit(50)
    .session(session ?? null);

  const deps = await query.lean();

  if (!deps || deps.length === 0) {
    return {
      available: true,
      asOf: null,
      reasonKey: "no_dependencies_defined",
      data: [],
    };
  }

  const prereqIds = deps.map((d) => d.prerequisiteProjectId);
  const prereqProjects = await Project.find({ _id: { $in: prereqIds } })
    .select("projectCode status plannedEndDate")
    .session(session ?? null)
    .lean();

  const prereqMap = new Map(prereqProjects.map((p) => [p._id.toString(), p]));

  const data: DependencyInputItem[] = deps.map((dep) => {
    const prereq = prereqMap.get(dep.prerequisiteProjectId.toString());
    return {
      id: dep._id.toString(),
      predecessorProjectId: dep.prerequisiteProjectId.toString(),
      predecessorProjectCode: prereq?.projectCode ?? null,
      predecessorStatus: prereq?.status ?? null,
      predecessorPlannedEnd: prereq?.plannedEndDate ? new Date(prereq.plannedEndDate) : null,
      isCriticalChain: false,
    };
  });

  return {
    available: true,
    asOf: deps[0]?.updatedAt ? new Date(deps[0].updatedAt) : new Date(),
    data,
  };
}
