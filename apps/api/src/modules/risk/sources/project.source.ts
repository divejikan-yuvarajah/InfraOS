import mongoose, { type ClientSession } from "mongoose";
import { Project } from "../../projects/models/project.model.js";
import { ProgressVerification } from "../../inspections/models/progress-verification.model.js";
import {
  projectReadFilter,
  type ResourceScope,
} from "../../identity/authorization/resource-scope.js";
import type { ProjectInputData, SourceEnvelope } from "../engine/types.js";

export async function fetchProjectSource(
  projectId: string,
  scope: ResourceScope,
  session?: ClientSession,
): Promise<SourceEnvelope<ProjectInputData>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
    };
  }

  const objId = new mongoose.Types.ObjectId(projectId);
  const filter = {
    $and: [
      projectReadFilter(scope),
      { _id: objId },
    ],
  };

  const projectQuery = Project.findOne(filter).session(session ?? null);
  const project = await projectQuery.lean();

  if (!project) {
    return {
      available: false,
      asOf: null,
      reasonKey: "project_not_found_or_forbidden",
    };
  }

  // Look for latest active verified progress from Batch 06
  const verificationQuery = ProgressVerification.findOne({
    projectId: objId,
    status: "ACTIVE",
  })
    .sort({ asOf: -1 })
    .session(session ?? null);
  const latestVerification = await verificationQuery.lean();

  const verifiedProgress = latestVerification
    ? {
        percent: latestVerification.verifiedPercent,
        asOf: latestVerification.asOf,
        verificationId: latestVerification._id.toString(),
      }
    : null;

  const physicalBasis = verifiedProgress ? "VERIFIED" : "REPORTED";

  const data: ProjectInputData = {
    id: project._id.toString(),
    projectCode: project.projectCode,
    title: project.title,
    status: project.status,
    agencyId: project.agencyId.toString(),
    projectType: project.projectType,
    district: (project as any).location?.district ?? undefined,
    startDate: project.startDate ? new Date(project.startDate) : null,
    plannedEndDate: project.plannedEndDate ? new Date(project.plannedEndDate) : null,
    actualEndDate: project.actualEndDate ? new Date(project.actualEndDate) : null,
    budgetMinor: project.budget?.amountMinor ?? 0,
    physicalProgress: project.physicalProgress ?? 0,
    financialProgress: project.financialProgress ?? 0,
    verifiedProgress,
    physicalBasis,
    contractorId: project.contractorId ? project.contractorId.toString() : null,
  };

  return {
    available: true,
    asOf: project.updatedAt ? new Date(project.updatedAt) : new Date(),
    data,
  };
}
