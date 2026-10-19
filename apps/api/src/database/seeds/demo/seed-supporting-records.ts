import { Asset } from "../../../modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../../../modules/assets/models/maintenance-record.model.js";
import { Document } from "../../../modules/documents/models/document.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { CitizenIssue } from "../../../modules/issues/models/citizen-issue.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { RiskAssessment } from "../../../modules/risk/models/risk-assessment.model.js";
import { demoDates } from "../helpers/dates.js";
import { GEO_BRIDGE_POINT, GEO_ISSUE_POTHOLE } from "../helpers/geometry.js";
import { lkr } from "../helpers/money.js";
import { ctxId, type DemoContext } from "./context.js";

export async function seedDemoSupportingRecords(
  context: DemoContext,
): Promise<{ assets: number; issues: number }> {
  const pm = ctxId(context.users, "PROJECT_MANAGER");
  const finance = ctxId(context.users, "FINANCE_OFFICER");
  const inspector = ctxId(context.users, "INSPECTOR");
  const citizen = ctxId(context.users, "CITIZEN");
  const roadProject = ctxId(context.projects, "INF-ROAD-001");
  const bridgeProject = ctxId(context.projects, "INF-BRIDGE-001");
  const delayedProject = ctxId(context.projects, "INF-PFAC-001");
  const alpha = ctxId(context.contractors, "SYNTH/ALPHA-001");

  await ProjectPayment.findOneAndUpdate(
    {
      projectId: roadProject,
      paymentType: "INTERIM",
      date: demoDates.payment1,
    },
    {
      $set: {
        contractorId: alpha,
        amount: lkr(120_000_000_00),
        status: "PAID",
        approvedBy: finance,
        createdBy: pm,
      },
      $setOnInsert: {
        projectId: roadProject,
        paymentType: "INTERIM",
        date: demoDates.payment1,
      },
    },
    { upsert: true, runValidators: true },
  );

  await ProjectPayment.findOneAndUpdate(
    {
      projectId: roadProject,
      paymentType: "ADVANCE",
      date: demoDates.payment2,
    },
    {
      $set: {
        contractorId: alpha,
        amount: lkr(85_000_000_00),
        status: "APPROVED",
        approvedBy: finance,
        createdBy: pm,
      },
      $setOnInsert: {
        projectId: roadProject,
        paymentType: "ADVANCE",
        date: demoDates.payment2,
      },
    },
    { upsert: true, runValidators: true },
  );

  const docFixtures = [
    { fileName: "demo-contract-agreement.pdf", documentType: "CONTRACT" },
    { fileName: "demo-boq-summary.pdf", documentType: "BOQ" },
    { fileName: "demo-progress-report-q1.pdf", documentType: "PROGRESS_REPORT" },
    { fileName: "demo-approval-letter.pdf", documentType: "APPROVAL" },
    { fileName: "demo-inspection-report-draft.pdf", documentType: "INSPECTION_REPORT" },
  ] as const;

  for (const doc of docFixtures) {
    await Document.findOneAndUpdate(
      { projectId: roadProject, fileName: doc.fileName },
      {
        $set: {
          documentType: doc.documentType,
          uploadedBy: pm,
          extractedTextStatus: "NOT_STARTED",
          visibility: "INTERNAL",
          mimeType: "application/pdf",
          sizeBytes: 48_000,
        },
        $setOnInsert: { projectId: roadProject, fileName: doc.fileName },
      },
      { upsert: true, runValidators: true },
    );
  }

  await Inspection.findOneAndUpdate(
    { projectId: roadProject, inspectionDate: demoDates.inspectionScheduled },
    {
      $set: {
        inspectorId: inspector,
        status: "SCHEDULED",
        notes: "Synthetic scheduled inspection — storage and forms deferred.",
      },
      $setOnInsert: {
        projectId: roadProject,
        inspectionDate: demoDates.inspectionScheduled,
      },
    },
    { upsert: true, runValidators: true },
  );

  await Inspection.findOneAndUpdate(
    { projectId: roadProject, inspectionDate: demoDates.inspectionVerified },
    {
      $set: {
        inspectorId: inspector,
        status: "VERIFIED",
        physicalProgress: 68,
        notes:
          "Reported project progress 75% vs verified 68% — documented variance, not a fraud finding.",
      },
      $setOnInsert: {
        projectId: roadProject,
        inspectionDate: demoDates.inspectionVerified,
      },
    },
    { upsert: true, runValidators: true },
  );

  await Project.updateOne({ _id: roadProject }, { $set: { physicalProgress: 75 } });

  const asset = await Asset.findOneAndUpdate(
    { sourceProjectId: bridgeProject, name: "Demo Riverside Bridge Asset" },
    {
      $set: {
        assetType: "BRIDGE",
        agencyId: ctxId(context.agencies, "DEMO_RDA"),
        location: {
          province: "Western Province",
          district: "Colombo",
          locality: "Demo Riverside",
          description: "Synthetic completed bridge handover.",
        },
        geometry: GEO_BRIDGE_POINT,
        condition: "GOOD",
        healthScore: 88,
        commissionedAt: demoDates.bridgeCommissioned,
        nextMaintenanceAt: demoDates.maintenanceUpcoming,
      },
      $setOnInsert: { sourceProjectId: bridgeProject, name: "Demo Riverside Bridge Asset" },
    },
    { upsert: true, new: true, runValidators: true },
  );
  context.assets.set("DEMO_BRIDGE_ASSET", asset._id);

  await MaintenanceRecord.findOneAndUpdate(
    {
      assetId: asset._id,
      maintenanceType: "ROUTINE",
      scheduledDate: demoDates.maintenanceCompleted,
    },
    {
      $set: {
        status: "COMPLETED",
        completedDate: demoDates.maintenanceCompleted,
        cost: lkr(2_500_000_00),
      },
      $setOnInsert: {
        assetId: asset._id,
        maintenanceType: "ROUTINE",
        scheduledDate: demoDates.maintenanceCompleted,
      },
    },
    { upsert: true, runValidators: true },
  );

  await MaintenanceRecord.findOneAndUpdate(
    {
      assetId: asset._id,
      maintenanceType: "PREVENTIVE",
      scheduledDate: demoDates.maintenanceUpcoming,
    },
    {
      $set: { status: "SCHEDULED" },
      $setOnInsert: {
        assetId: asset._id,
        maintenanceType: "PREVENTIVE",
        scheduledDate: demoDates.maintenanceUpcoming,
      },
    },
    { upsert: true, runValidators: true },
  );

  await RiskAssessment.findOneAndUpdate(
    { projectId: delayedProject, modelVersion: "DEMO-RULES-v1" },
    {
      $set: {
        overallRisk: 72,
        delayRisk: 80,
        budgetRisk: 55,
        scheduleRisk: 78,
        factors: [
          {
            category: "SCHEDULE",
            description: "Synthetic delayed milestone pattern for demo dashboards.",
            score: 78,
          },
        ],
        recommendations: [
          "Review delayed mobilization milestone before approving additional spend (demo text only).",
        ],
      },
      $setOnInsert: { projectId: delayedProject, modelVersion: "DEMO-RULES-v1" },
    },
    { upsert: true, runValidators: true },
  );

  const issueFixtures = [
    {
      category: "POTHOLE",
      description: "Synthetic pothole report near demo corridor (not verified by city).",
      geometry: GEO_ISSUE_POTHOLE,
      agency: "DEMO_RDA",
    },
    {
      category: "WATER_LEAK",
      description: "Synthetic water leak report for prototype routing.",
      geometry: GEO_ISSUE_POTHOLE,
      agency: "DEMO_WATER",
    },
    {
      category: "DRAINAGE",
      description: "Synthetic blocked drainage report — demo only.",
      geometry: GEO_ISSUE_POTHOLE,
      agency: "AGENCY_DEMO_DRAINAGE",
    },
    {
      category: "STREET_LIGHT",
      description: "Synthetic streetlight damage near utility corridor.",
      geometry: GEO_ISSUE_POTHOLE,
      agency: "DEMO_ELEC",
    },
  ] as const;

  for (const issue of issueFixtures) {
    await CitizenIssue.findOneAndUpdate(
      { citizenId: citizen, category: issue.category, description: issue.description },
      {
        $set: {
          location: {
            province: "Western Province",
            district: "Colombo",
            locality: "Demo corridor",
            description: issue.description,
          },
          geometry: issue.geometry,
          assignedAgency: ctxId(context.agencies, issue.agency),
          status: "ASSIGNED",
          priority: "NORMAL",
        },
        $setOnInsert: {
          citizenId: citizen,
          category: issue.category,
          description: issue.description,
        },
      },
      { upsert: true, runValidators: true },
    );
  }

  return { assets: 1, issues: issueFixtures.length };
}
