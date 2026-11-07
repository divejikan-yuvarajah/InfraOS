import { SYSTEM_ROLE_KEYS } from "@infraos/shared-types";

import { Agency } from "../../../modules/agencies/models/agency.model.js";
import { Asset } from "../../../modules/assets/models/asset.model.js";
import { HazardZone } from "../../../modules/risk/models/hazard-zone.model.js";
import { Milestone } from "../../../modules/projects/models/milestone.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { Contractor } from "../../../modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../../../modules/contractors/models/contractor-assignment.model.js";
import { ProjectBudgetRevision } from "../../../modules/finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../../../modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { AssetConditionAssessment } from "../../../modules/assets/models/asset-condition-assessment.model.js";
import { AssetConversion } from "../../../modules/assets/models/asset-conversion.model.js";
import { MaintenanceRecord } from "../../../modules/assets/models/maintenance-record.model.js";
import { InspectionEvidence } from "../../../modules/inspections/models/inspection-evidence.model.js";
import { ProgressVerification } from "../../../modules/inspections/models/progress-verification.model.js";
import { Role } from "../../../modules/identity/models/role.model.js";
import { WorkRequest } from "../../../modules/roadsync/models/work-request.model.js";
import { CitizenIssue } from "../../../modules/issues/models/citizen-issue.model.js";
import { demoDates } from "../helpers/dates.js";
import {
  DEMO_CONTRACTOR_REGS,
  DEMO_LAYER_AGENCY_CODES,
  DEMO_MILESTONE_TITLES,
  DEMO_LIFECYCLE_PROJECT_CODES,
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

  // Batch 05: finance.
  const projectIds = projects.map((p) => p._id);
  const revisions = await ProjectBudgetRevision.find({ projectId: { $in: projectIds } }).lean();
  const approvedTotal = (id: unknown) => revisions.filter((r) => String(r.projectId) === String(id) && r.status === "APPROVED").sort((a, b) => b.sequence - a.sequence)[0]?.newTotal.amountMinor;
  lines.push({
    name: "Finance: budget ledger matches Project.budget, with an approved and a pending revision and allocations",
    pass: projects.every((p) => approvedTotal(p._id) === p.budget.amountMinor)
      && revisions.some((r) => r.kind === "REVISION" && r.status === "APPROVED") && revisions.some((r) => r.status === "PENDING_APPROVAL") && revisions.filter((r) => r.allocations.length > 0).length >= 2,
    detail: `revisions=${revisions.length}`,
  });
  const pays = await ProjectPayment.find({ projectId: { $in: projectIds } }).lean();
  const exps = await ProjectExpense.find({ projectId: { $in: projectIds } }).lean();
  const has = (rows: { status: string }[], ...s: string[]) => s.every((x) => rows.some((r) => r.status === x));
  lines.push({
    name: "Finance: payments and expenses cover every status, with numbers, across two contractors",
    pass: has(pays, "PENDING", "APPROVED", "PAID", "REJECTED", "CANCELLED", "REVERSED") && has(exps, "DRAFT", "PENDING_VERIFICATION", "VERIFIED", "REJECTED", "REVERSED")
      && pays.every((p) => Boolean(p.paymentNo)) && new Set(pays.map((p) => String(p.contractorId))).size >= 2 && pays.length >= 8 && exps.length >= 8,
    detail: `payments=${pays.length} expenses=${exps.length}`,
  });
  const util = (code: string) => {
    const p = projects.find((x) => x.projectCode === code);
    const committed = pays.filter((x) => String(x.projectId) === String(p?._id) && (x.status === "APPROVED" || x.status === "PAID")).reduce((s, x) => s + x.amount.amountMinor, 0);
    return p ? (committed * 10000) / p.budget.amountMinor : 0;
  };
  const verifiedRoad = await ProgressVerification.findOne({ projectId: road?._id, status: "ACTIVE" }).lean();
  const pfacId = projects.find((p) => p.projectCode === "INF-PFAC-001")?._id;
  const verifiedPfac = await ProgressVerification.findOne({ projectId: pfacId, status: "ACTIVE" }).lean();
  lines.push({
    name: "Finance: a near-budget project, a spend-ahead project and a verified-progress project",
    pass: util("INF-BRIDGE-001") >= 9500 && util("INF-PFAC-001") >= 6000 && Boolean(verifiedRoad) && Boolean(verifiedPfac),
  });
  const inspections = await Inspection.find({ inspectionNo: /^INS-2026-9000/ }).select("status inspectionType").lean();
  const statuses = new Set(inspections.map((i) => i.status));
  const verifications = await ProgressVerification.find({ status: "ACTIVE" }).select("discrepancyPp").lean();
  const evidenceRows = await InspectionEvidence.find({ status: "ACTIVE" }).select("_id inspectionId").lean();
  lines.push({
    name: "Inspections: all statuses and types, evidence stored privately, one consistent and one discrepant verification",
    pass: inspections.length >= 10 && ["SCHEDULED", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "REQUIRES_REVIEW", "REJECTED", "CANCELLED"].every((s) => statuses.has(s as never)) && new Set(inspections.map((i) => i.inspectionType)).size >= 5
      && evidenceRows.length >= 3 && verifications.some((v) => typeof v.discrepancyPp === "number" && Math.abs(v.discrepancyPp) > 10) && verifications.some((v) => typeof v.discrepancyPp === "number" && Math.abs(v.discrepancyPp) <= 10),
    detail: `inspections=${inspections.length} evidence=${evidenceRows.length} verifications=${verifications.length}`,
  });
  const lifecycle = await Project.find({ projectCode: { $in: [...DEMO_LIFECYCLE_PROJECT_CODES] } }).select("_id").lean();
  const conversions = await AssetConversion.find({ projectId: { $in: lifecycle.map((p) => p._id) } }).select("status createdAssetIds").lean();
  const lifeAssets = await Asset.find({ assetNo: /^AST-2026-9000/ }).select("healthScore condition").lean();
  const bridgeAssets = await Asset.find({ name: "Demo Riverside Bridge Asset" }).select("_id healthScore").lean();
  const assessments = await AssetConditionAssessment.find({ assetId: { $in: [...lifeAssets.map((a) => a._id), ...bridgeAssets.map((a) => a._id)] } }).select("assetId status basis").lean();
  const maint = await MaintenanceRecord.find({ maintenanceNo: /^MNT-2026-9000/ }).select("status cost").lean();
  const withHealth = [...lifeAssets, ...bridgeAssets].filter((a) => typeof a.healthScore === "number").length;
  lines.push({
    name: "Asset lifecycle: converted and pending conversions, assessments, maintenance and evidence-gated health",
    pass: lifecycle.length === DEMO_LIFECYCLE_PROJECT_CODES.length && conversions.some((c) => c.status === "APPROVED" && c.createdAssetIds.length === 2) && conversions.some((c) => c.status === "PENDING_APPROVAL")
      && assessments.some((a) => a.basis === "INSPECTION_VERIFIED") && assessments.filter((a) => a.status === "ACTIVE").length === 2 && ["REQUESTED", "SCHEDULED", "COMPLETED"].every((st) => maint.some((m) => m.status === st))
      && maint.some((m) => m.status === "COMPLETED" && m.cost) && withHealth >= 1 && withHealth < lifeAssets.length + bridgeAssets.length,
    detail: `assets=${lifeAssets.length + bridgeAssets.length} withHealth=${withHealth} assessments=${assessments.length} maintenance=${maint.length}`,
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
