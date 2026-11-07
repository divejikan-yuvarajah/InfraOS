import { Asset } from "../../../modules/assets/models/asset.model.js";
import { HazardZone } from "../../../modules/risk/models/hazard-zone.model.js";
import { MaintenanceRecord } from "../../../modules/assets/models/maintenance-record.model.js";
import { Document } from "../../../modules/documents/models/document.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { User } from "../../../modules/identity/models/user.model.js";
import { AssetConditionAssessment } from "../../../modules/assets/models/asset-condition-assessment.model.js";
import { AssetConversion } from "../../../modules/assets/models/asset-conversion.model.js";
import { MaintenanceEvidence } from "../../../modules/assets/models/maintenance-evidence.model.js";
import mongoose from "mongoose";
import { InspectionEvidence } from "../../../modules/inspections/models/inspection-evidence.model.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { ProgressVerification } from "../../../modules/inspections/models/progress-verification.model.js";
import { CitizenIssue } from "../../../modules/issues/models/citizen-issue.model.js";
import { Milestone } from "../../../modules/projects/models/milestone.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { RiskAssessment } from "../../../modules/risk/models/risk-assessment.model.js";
import { WorkRequest } from "../../../modules/roadsync/models/work-request.model.js";
import { Contractor } from "../../../modules/contractors/models/contractor.model.js";
import { ProjectBudgetRevision } from "../../../modules/finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../../../modules/finance/models/project-expense.model.js";
import { ContractorAssignment } from "../../../modules/contractors/models/contractor-assignment.model.js";
import { Agency } from "../../../modules/agencies/models/agency.model.js";
import {
  assertDemoSeedEnvironment,
  type SeedEnvSlice,
} from "../helpers/seed-guard.js";
import { isDemoFixtureUserEmail } from "../helpers/fixture-users.js";
import {
  DEMO_CONTRACTOR_REGS,
  DEMO_LAYER_AGENCY_CODES,
  DEMO_LIFECYCLE_PROJECT_CODES,
  DEMO_PROJECT_CODES,
} from "./catalog.js";

export async function resetDemoData(seedEnv: SeedEnvSlice): Promise<void> {
  assertDemoSeedEnvironment(seedEnv);

  const demoUsers = await User.find({
    email: { $regex: /@infraos-demo\.invalid$/i },
  }).select("_id email");
  const demoUserIds = demoUsers.map((u) => u._id);

  for (const user of demoUsers) {
    if (!isDemoFixtureUserEmail(user.email)) {
      throw new Error("Refusing reset: unexpected user email pattern");
    }
  }

  const demoProjects = await Project.find({
    projectCode: { $in: [...DEMO_PROJECT_CODES, ...DEMO_LIFECYCLE_PROJECT_CODES] },
  }).select("_id");
  const demoProjectIds = demoProjects.map((p) => p._id);

  if (demoUserIds.length > 0) {
    await CitizenIssue.deleteMany({ citizenId: { $in: demoUserIds } });
  }

  const demoAssets = await Asset.find({
    sourceProjectId: { $in: demoProjectIds },
  }).select("_id");
  const demoAssetIds = demoAssets.map((a) => a._id);
  if (demoAssetIds.length > 0) {
    // Maintenance photos (GridFS), their rows, the append-only assessment ledger and conversions go before the assets they point at.
    const maint = (await MaintenanceRecord.find({ assetId: { $in: demoAssetIds } }).select("_id").lean()).map((m) => String(m._id));
    const gridDb = mongoose.connection.db;
    if (gridDb && maint.length) {
      const files = gridDb.collection("inspectionEvidence.files");
      const chunks = gridDb.collection("inspectionEvidence.chunks");
      for (const id of maint) for (const f of await files.find({ filename: { $regex: `^mnt/${id}/` } }).toArray()) { await chunks.deleteMany({ files_id: f._id }); await files.deleteOne({ _id: f._id }); }
    }
    await MaintenanceEvidence.deleteMany({ assetId: { $in: demoAssetIds } });
    await AssetConditionAssessment.collection.deleteMany({ assetId: { $in: demoAssetIds } });
    await MaintenanceRecord.deleteMany({ assetId: { $in: demoAssetIds } });
    await Asset.deleteMany({ _id: { $in: demoAssetIds } });
  }

  // Demo hazard zones are identified only by the isDemo flag and the DEMO source kind; imported datasets are never touched.
  await HazardZone.deleteMany({ isDemo: true, "source.kind": "DEMO" });

  // Assignments of demo projects belong to the demo only; audit rows stay (append-only).
  if (demoProjectIds.length > 0) {
    // The budget ledger is append-only through the model, so the reset clears it natively; expenses and payments are ordinary rows.
    await ProjectBudgetRevision.collection.deleteMany({ projectId: { $in: demoProjectIds } });
    await ProjectExpense.deleteMany({ projectId: { $in: demoProjectIds } });
  }
  if (demoProjectIds.length > 0) await ContractorAssignment.deleteMany({ projectId: { $in: demoProjectIds } });

  if (demoProjectIds.length > 0) {
    await RiskAssessment.deleteMany({ projectId: { $in: demoProjectIds } });
    // Evidence bytes (GridFS), evidence rows and the append-only verification ledger go before the inspections they point at.
    const inspectionIds = (await Inspection.find({ projectId: { $in: demoProjectIds } }).select("_id").lean()).map((i) => String(i._id));
    const db = mongoose.connection.db;
    if (db && inspectionIds.length) {
      const files = db.collection("inspectionEvidence.files");
      const chunks = db.collection("inspectionEvidence.chunks");
      for (const id of inspectionIds) {
        for (const f of await files.find({ filename: { $regex: `^ins/${id}/` } }).toArray()) {
          await chunks.deleteMany({ files_id: f._id });
          await files.deleteOne({ _id: f._id });
        }
      }
    }
    await InspectionEvidence.deleteMany({ projectId: { $in: demoProjectIds } });
    await ProgressVerification.collection.deleteMany({ projectId: { $in: demoProjectIds } });
    await AssetConversion.deleteMany({ projectId: { $in: demoProjectIds } });
    await Inspection.deleteMany({ projectId: { $in: demoProjectIds } });
    await Document.deleteMany({ projectId: { $in: demoProjectIds } });
    await ProjectPayment.deleteMany({ projectId: { $in: demoProjectIds } });
    await WorkRequest.deleteMany({ projectId: { $in: demoProjectIds } });
    await Milestone.deleteMany({ projectId: { $in: demoProjectIds } });
    await Project.deleteMany({ _id: { $in: demoProjectIds } });
  }

  await Contractor.deleteMany({
    registrationNumber: { $in: [...DEMO_CONTRACTOR_REGS] },
  });

  if (demoUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: demoUserIds } });
  }

  await Agency.deleteMany({
    code: { $in: [...DEMO_LAYER_AGENCY_CODES] },
  });
}
