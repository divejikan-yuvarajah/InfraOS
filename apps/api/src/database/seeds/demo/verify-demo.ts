import { SYSTEM_ROLE_KEYS } from "@infraos/shared-types";

import { Agency } from "../../../modules/agencies/models/agency.model.js";
import { Asset } from "../../../modules/assets/models/asset.model.js";
import { HazardZone } from "../../../modules/risk/models/hazard-zone.model.js";
import { Milestone } from "../../../modules/projects/models/milestone.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { Contractor } from "../../../modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../../../modules/contractors/models/contractor-assignment.model.js";
import { Role } from "../../../modules/identity/models/role.model.js";
import { WorkRequest } from "../../../modules/roadsync/models/work-request.model.js";
import { CitizenIssue } from "../../../modules/issues/models/citizen-issue.model.js";
import { demoDates } from "../helpers/dates.js";
import {
  DEMO_CONTRACTOR_REGS,
  DEMO_LAYER_AGENCY_CODES,
  DEMO_MILESTONE_TITLES,
  DEMO_PROJECT_CODES,
  SPATIAL_VERIFY,
} from "./catalog.js";

export type VerifyLine = { name: string; pass: boolean; detail?: string };

export type VerifyDemoResult = {
  lines: VerifyLine[];
  pass: boolean;
};

export async function verifyDemoSeed(): Promise<VerifyDemoResult> {
  const lines: VerifyLine[] = [];

  const roleCount = await Role.countDocuments();
  lines.push({
    name: "Core roles",
    pass: roleCount === SYSTEM_ROLE_KEYS.length,
    detail: `count=${roleCount}`,
  });

  const agencyCodes = [
    "DEMO_RDA",
    "DEMO_WATER",
    ...DEMO_LAYER_AGENCY_CODES,
  ];
  const agencies = await Agency.find({ code: { $in: agencyCodes } });
  lines.push({
    name: "Agencies",
    pass: agencies.length >= 6,
    detail: `found=${agencies.length}`,
  });

  const projects = await Project.find({
    projectCode: { $in: [...DEMO_PROJECT_CODES] },
  });
  lines.push({
    name: "Projects",
    pass: projects.length === DEMO_PROJECT_CODES.length,
    detail: `found=${projects.length}`,
  });

  const road = projects.find((p) => p.projectCode === "INF-ROAD-001");
  const water = projects.find((p) => p.projectCode === "INF-WATER-001");
  lines.push({
    name: "Relationships",
    pass: Boolean(road?.agencyId && water?.agencyId && road.createdBy),
  });

  const workCount = await WorkRequest.countDocuments({
    projectId: { $in: projects.map((p) => p._id) },
  });
  lines.push({
    name: "Work requests",
    pass: workCount >= 6,
    detail: `count=${workCount}`,
  });

  const roadWork = await WorkRequest.findOne({
    projectId: road?._id,
    workType: "ROAD_RESURFACING",
    plannedStart: demoDates.wrRoadStart,
  });
  const waterWork = await WorkRequest.findOne({
    projectId: water?._id,
    workType: "PIPELINE_INSTALLATION",
    plannedStart: demoDates.wrWaterStart,
  });

  lines.push({
    name: "RoadSync candidate scenario",
    pass: Boolean(roadWork?.geometry && waterWork?.geometry),
  });

  const candidates = await WorkRequest.find({
    geometry: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: SPATIAL_VERIFY.probePoint,
        },
        $maxDistance: SPATIAL_VERIFY.maxDistanceMeters,
      },
    },
    status: { $in: ["ACTIVE", "APPROVED", "PLANNED"] },
    plannedStart: { $lte: SPATIAL_VERIFY.probeEnd },
    plannedEnd: { $gte: SPATIAL_VERIFY.probeStart },
  });

  const candidateIds = new Set(candidates.map((c) => c.id));
  lines.push({
    name: "Spatial verification",
    pass: Boolean(
      roadWork &&
        waterWork &&
        candidateIds.has(roadWork.id) &&
        candidateIds.has(waterWork.id),
    ),
    detail: `candidates=${candidates.length}`,
  });

  const farControl = await WorkRequest.findOne({
    workType: "DRAINAGE_WORK",
    plannedStart: demoDates.wrFarStart,
  });
  lines.push({
    name: "Non-conflict control",
    pass: Boolean(farControl && !candidateIds.has(farControl.id)),
  });

  const milestoneCount = await Milestone.countDocuments({
    projectId: road?._id,
    title: { $in: [...DEMO_MILESTONE_TITLES] },
  });
  lines.push({
    name: "Milestones",
    pass: milestoneCount === DEMO_MILESTONE_TITLES.length,
    detail: `count=${milestoneCount}`,
  });

  const asset = await Asset.findOne({ name: "Demo Riverside Bridge Asset" });
  lines.push({
    name: "Assets",
    pass: Boolean(asset?.sourceProjectId),
  });

  const demoHazards = await HazardZone.find({ isDemo: true }).select("name source.kind").lean();
  const restrictedMain = await Asset.findOne({ name: "[DEMO] Water main (restricted)" }).select("sensitivity").lean();
  lines.push({
    name: "InfraMap demo hazards and restricted utility",
    pass: demoHazards.length >= 2 && demoHazards.every((z) => z.name.startsWith("[DEMO]") && z.source.kind === "DEMO") && restrictedMain?.sensitivity === "RESTRICTED",
    detail: `hazards=${demoHazards.length}`,
  });

  const issues = await CitizenIssue.countDocuments();
  lines.push({
    name: "Citizen issues",
    pass: issues >= 4,
    detail: `count=${issues}`,
  });

  const duplicateProjects = await Project.aggregate([
    { $match: { projectCode: { $in: [...DEMO_PROJECT_CODES] } } },
    { $group: { _id: "$projectCode", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  lines.push({
    name: "No duplicate demo records",
    pass: duplicateProjects.length === 0,
  });

  // Batch 04: contractors and assignments.
  const demoContractors = await Contractor.find({ registrationNumber: { $in: [...DEMO_CONTRACTOR_REGS] } }).select("+lockSeq").lean();
  const soonLimit = Date.now() + 30 * 86_400_000;
  const certs = demoContractors.flatMap((c) => c.certifications ?? []);
  lines.push({
    name: "Contractors: owner agency, no legacy cache, certification watch",
    pass: demoContractors.length === DEMO_CONTRACTOR_REGS.length
      && demoContractors.every((c) => c.registeredByAgencyId && c.category && c.rating === undefined && c.riskLevel === undefined && c.activeProjects === undefined && c.completedProjects === undefined)
      && certs.some((c) => c.expiresOn && c.expiresOn.getTime() < Date.now())
      && certs.some((c) => c.expiresOn && c.expiresOn.getTime() > Date.now() && c.expiresOn.getTime() <= soonLimit),
    detail: `contractors=${demoContractors.length}`,
  });
  const demoAssignments = await ContractorAssignment.find({ projectId: { $in: projects.map((p) => p._id) } }).lean();
  const byId = new Map(demoAssignments.map((a) => [String(a._id), a]));
  const replaced = demoAssignments.filter((a) => a.status === "REPLACED");
  const activePrimaryByProject = new Map(demoAssignments.filter((a) => a.role === "PRIMARY" && a.status === "ACTIVE").map((a) => [String(a.projectId), String(a.contractorId)]));
  lines.push({
    name: "Assignments: primary, ended, additional, replaced chain",
    pass: demoAssignments.some((a) => a.role === "PRIMARY" && a.status === "ACTIVE")
      && demoAssignments.some((a) => a.status === "ENDED")
      && demoAssignments.some((a) => a.role === "ADDITIONAL")
      && replaced.length > 0 && replaced.every((a) => a.replacedByAssignmentId && byId.has(String(a.replacedByAssignmentId))),
    detail: `assignments=${demoAssignments.length}`,
  });
  lines.push({
    name: "Project.contractorId matches the active primary (open projects)",
    pass: projects.filter((p) => !["COMPLETED", "CANCELLED"].includes(p.status) && p.contractorId).every((p) => activePrimaryByProject.get(String(p._id)) === String(p.contractorId)),
  });

  const pass = lines.every((line) => line.pass);
  return { lines, pass };
}

export function formatVerifyReport(result: VerifyDemoResult): string {
  const header = "INFRAOS demo seed verification";
  const body = result.lines
    .map((line) => `${line.name}: ${line.pass ? "PASS" : "FAIL"}${line.detail ? ` (${line.detail})` : ""}`)
    .join("\n");
  return `${header}\n${body}\nOverall: ${result.pass ? "PASS" : "FAIL"}`;
}
