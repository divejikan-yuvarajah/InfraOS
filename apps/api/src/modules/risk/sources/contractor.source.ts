import mongoose, { type ClientSession } from "mongoose";
import { Contractor } from "../../contractors/models/contractor.model.js";
import { ContractorAssignment } from "../../contractors/models/contractor-assignment.model.js";
import { Project } from "../../projects/models/project.model.js";
import { calendarDaysBetween } from "../engine/math.js";
import type { ContractorInputData, SourceEnvelope } from "../engine/types.js";

export async function fetchContractorSource(
  contractorId: string | null | undefined,
  session?: ClientSession,
): Promise<SourceEnvelope<ContractorInputData>> {
  if (!contractorId || !mongoose.Types.ObjectId.isValid(contractorId)) {
    return {
      available: true,
      asOf: null,
      reasonKey: "no_contractor_assigned",
      data: {
        assigned: false,
        priorClosedProjectsCount: 0,
        priorProjectsDelayedCount: 0,
        activeAssignmentsCount: 0,
      },
    };
  }

  const objId = new mongoose.Types.ObjectId(contractorId);

  const contractor = await Contractor.findById(objId)
    .select("name")
    .session(session ?? null)
    .lean();

  const contractorName = contractor?.name ?? null;

  // 1. Overlapping active assignments count
  const activeAssignmentsCount = await ContractorAssignment.countDocuments({
    contractorId: objId,
    status: "ACTIVE",
  }).session(session ?? null);

  // 2. Prior closed projects summary
  // Look for assignments that have ended or projects that have completed
  const endedAssignments = await ContractorAssignment.find({
    contractorId: objId,
    status: "ENDED",
  })
    .select("projectId")
    .session(session ?? null)
    .lean();

  const projectIds = endedAssignments.map((a) => a.projectId);

  let priorClosedProjectsCount = 0;
  let priorProjectsDelayedCount = 0;

  if (projectIds.length > 0) {
    const closedProjects = await Project.find({
      _id: { $in: projectIds },
      status: { $in: ["COMPLETED", "DELAYED", "CANCELLED"] },
    })
      .select("status startDate plannedEndDate actualEndDate")
      .session(session ?? null)
      .lean();

    priorClosedProjectsCount = closedProjects.length;

    for (const proj of closedProjects) {
      if (proj.status === "DELAYED") {
        priorProjectsDelayedCount++;
      } else if (proj.plannedEndDate && proj.actualEndDate) {
        const daysLate = calendarDaysBetween(
          new Date(proj.plannedEndDate),
          new Date(proj.actualEndDate),
        );
        if (daysLate > 14) {
          priorProjectsDelayedCount++;
        }
      }
    }
  }

  return {
    available: true,
    asOf: new Date(),
    data: {
      assigned: true,
      contractorId: objId.toString(),
      contractorName,
      priorClosedProjectsCount,
      priorProjectsDelayedCount,
      activeAssignmentsCount,
    },
  };
}
