import { Asset } from "../../../modules/assets/models/asset.model.js";
import { MaintenanceRecord } from "../../../modules/assets/models/maintenance-record.model.js";
import { Document } from "../../../modules/documents/models/document.model.js";
import { ProjectPayment } from "../../../modules/finance/models/project-payment.model.js";
import { User } from "../../../modules/identity/models/user.model.js";
import { Inspection } from "../../../modules/inspections/models/inspection.model.js";
import { CitizenIssue } from "../../../modules/issues/models/citizen-issue.model.js";
import { Milestone } from "../../../modules/projects/models/milestone.model.js";
import { Project } from "../../../modules/projects/models/project.model.js";
import { RiskAssessment } from "../../../modules/risk/models/risk-assessment.model.js";
import { WorkRequest } from "../../../modules/roadsync/models/work-request.model.js";
import { Contractor } from "../../../modules/contractors/models/contractor.model.js";
import { Agency } from "../../../modules/agencies/models/agency.model.js";
import {
  assertDemoSeedEnvironment,
  type SeedEnvSlice,
} from "../helpers/seed-guard.js";
import { isDemoFixtureUserEmail } from "../helpers/fixture-users.js";
import {
  DEMO_CONTRACTOR_REGS,
  DEMO_LAYER_AGENCY_CODES,
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
    projectCode: { $in: [...DEMO_PROJECT_CODES] },
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
    await MaintenanceRecord.deleteMany({ assetId: { $in: demoAssetIds } });
    await Asset.deleteMany({ _id: { $in: demoAssetIds } });
  }

  if (demoProjectIds.length > 0) {
    await RiskAssessment.deleteMany({ projectId: { $in: demoProjectIds } });
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
