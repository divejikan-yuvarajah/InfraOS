import { seedCoreIdentity } from "../core/identity.js";
import {
  assertDemoSeedEnvironment,
  type SeedEnvSlice,
} from "../helpers/seed-guard.js";
import type { DemoContext } from "./context.js";
import { loadAgencyMap, seedDemoAgencies } from "./seed-agencies.js";
import { seedDemoContractors } from "./seed-contractors.js";
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
  projects: number;
  workRequests: number;
  assets: number;
  citizenIssues: number;
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
    contractors: await seedDemoContractors(),
    projects: new Map(),
    assets: new Map(),
  };

  context.users = await seedDemoFixtureUsers(context);
  context.projects = await seedDemoProjects(context);
  const workRequests = await seedDemoWorkRequests(context);
  const supporting = await seedDemoSupportingRecords(context);

  return {
    roles: core.roles,
    coreAgencies: core.agencies,
    demoAgencies: agencies.size - core.agencies,
    fixtureUsers: context.users.size,
    contractors: context.contractors.size,
    projects: context.projects.size,
    workRequests,
    assets: supporting.assets,
    citizenIssues: supporting.issues,
  };
}
