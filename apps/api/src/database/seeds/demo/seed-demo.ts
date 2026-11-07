import { seedCoreIdentity } from "../core/identity.js";
import {
  assertDemoSeedEnvironment,
  type SeedEnvSlice,
} from "../helpers/seed-guard.js";
import type { DemoContext } from "./context.js";
import { loadAgencyMap, seedDemoAgencies } from "./seed-agencies.js";
import { seedDemoAssignments } from "./seed-assignments.js";
import { seedDemoContractors } from "./seed-contractors.js";
import { seedDemoFinance } from "./seed-finance.js";
import { seedDemoInframapContext } from "./seed-inframap-context.js";
import { seedDemoAssets } from "./seed-assets.js";
import { seedDemoInspections } from "./seed-inspections.js";
import { seedDemoProjects } from "./seed-projects.js";
import { seedDemoSupportingRecords } from "./seed-supporting-records.js";
import { seedDemoFixtureUsers } from "./seed-users.js";
import { seedDemoWorkRequests } from "./seed-work-requests.js";

export type SeedDemoSummary = {
  roles: number;
  coreAgencies: number;
  demoAgencies: number;
  fixtureUsers: number;
  contractors: number;
  assignments: number;
  financeRecords: number;
  inspections: number;
  lifecycleAssets: number;
  lifecycleAssessments: number;
  lifecycleMaintenance: number;
  lifecycleConversions: number;
  inspectionEvidence: number;
  progressVerifications: number;
  projects: number;
  workRequests: number;
  assets: number;
  citizenIssues: number;
  inframapAssets: number;
  hazardZones: number;
};

export async function seedDemoData(
  seedEnv: SeedEnvSlice,
): Promise<SeedDemoSummary> {
  assertDemoSeedEnvironment(seedEnv);

  const core = await seedCoreIdentity(seedEnv);
  let agencies = await loadAgencyMap();
  agencies = await seedDemoAgencies(agencies);

  const context: DemoContext = {
    agencies,
    users: new Map(),
    roles: new Map(),
    contractors: await seedDemoContractors(agencies),
    projects: new Map(),
    assets: new Map(),
  };

  context.users = await seedDemoFixtureUsers(context);
  context.projects = await seedDemoProjects(context);
  const assignments = await seedDemoAssignments(context);
  const workRequests = await seedDemoWorkRequests(context);
  const supporting = await seedDemoSupportingRecords(context);
  const finance = await seedDemoFinance(context);
  const inspections = await seedDemoInspections(context);
  const lifecycle = await seedDemoAssets(context);
  const inframap = await seedDemoInframapContext(context);

  return {
    roles: core.roles,
    coreAgencies: core.agencies,
    demoAgencies: agencies.size - core.agencies,
    fixtureUsers: context.users.size,
    contractors: context.contractors.size,
    assignments,
    financeRecords: finance.revisions + finance.payments + finance.expenses,
    inspections: inspections.inspections,
    lifecycleAssets: lifecycle.assets,
    lifecycleAssessments: lifecycle.assessments,
    lifecycleMaintenance: lifecycle.maintenance,
    lifecycleConversions: lifecycle.conversions,
    inspectionEvidence: inspections.evidence,
    progressVerifications: inspections.verifications,
    projects: context.projects.size,
    workRequests,
    assets: supporting.assets,
    citizenIssues: supporting.issues,
    inframapAssets: inframap.assets,
    hazardZones: inframap.hazardZones,
  };
}
