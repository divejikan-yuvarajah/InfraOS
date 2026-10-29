/**
 * Disposable Mongo for the Step 60 browser demo.
 * ACTIVE projects are fixtures. PAID rows are synthetic stored records, not bank payments.
 * Does not read Atlas. Does not print the fixture password.
 */
import { hash } from "bcryptjs";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { Agency } from "../modules/agencies/models/agency.model.js";
import { Contractor } from "../modules/contractors/models/contractor.model.js";
import { ProjectPayment } from "../modules/finance/models/project-payment.model.js";
import { Role } from "../modules/identity/models/role.model.js";
import { User } from "../modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../modules/identity/seed/system-role-permissions.js";
import { Inspection } from "../modules/inspections/models/inspection.model.js";
import { Milestone } from "../modules/projects/models/milestone.model.js";
import { Project } from "../modules/projects/models/project.model.js";
import type { SystemRoleKey } from "@infraos/shared-types";
import { startIsolatedMongo } from "../../tests/helpers/mongo-memory.js";

const DEMO_PASSWORD = "correct-horse-battery";

async function seedRoles() {
  for (const key of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[]) {
    await Role.create({
      key,
      name: SYSTEM_ROLE_META[key].name,
      description: SYSTEM_ROLE_META[key].description,
      permissions: [...SYSTEM_ROLE_PERMISSIONS[key]],
      scopeType: SYSTEM_ROLE_META[key].scopeType,
      isSystem: true,
      isActive: true,
    });
  }
}

async function user(email: string, roleKey: SystemRoleKey, agencyId: unknown, firstName: string) {
  const role = await Role.findOne({ key: roleKey });
  if (!role) throw new Error(`missing ${roleKey}`);
  return User.create({
    firstName,
    lastName: "Fixture",
    email,
    passwordHash: await hash(DEMO_PASSWORD, 4),
    roleId: role._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 1,
  });
}

async function main(): Promise<void> {
  env.ACCESS_TOKEN_SECRET = "access-secret-step60-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step60-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4011);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3001";
  await startIsolatedMongo();
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const manager = await user("step60-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  const inspector = await user("step60-inspector@example.com", "INSPECTOR", child._id, "Inspector");
  const other = await Agency.create({ code: "MIN_OTHER", name: "Other ministry", type: "MINISTRY", status: "ACTIVE" });
  const foreign = await user("step60-foreign@example.com", "AGENCY_OFFICER", other._id, "Foreign");
  const company = await Contractor.create({ name: "Synthetic Works", registrationNumber: "REG-60", status: "ACTIVE" });
  const mainProject = await Project.create({
    projectCode: "INF-FIN-6001",
    title: "Synthetic finance comparison road",
    description: "Fixture ACTIVE project with synthetic PAID rows.",
    projectType: "ROAD",
    agencyId: child._id,
    managerId: manager._id,
    budget: { amountMinor: 1000000, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "ACTIVE",
    createdBy: manager._id,
  });
  const missing = await Project.create({
    projectCode: "INF-FIN-6002",
    title: "Synthetic missing budget road",
    projectType: "ROAD",
    agencyId: child._id,
    managerId: manager._id,
    budget: { amountMinor: 0, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "ACTIVE",
    createdBy: manager._id,
  });
  const overrun = await Project.create({
    projectCode: "INF-FIN-6003",
    title: "Synthetic overrun road",
    projectType: "ROAD",
    agencyId: child._id,
    managerId: manager._id,
    budget: { amountMinor: 10000, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "ACTIVE",
    createdBy: manager._id,
  });
  await ProjectPayment.create({
    projectId: mainProject._id,
    contractorId: company._id,
    amount: { amountMinor: 400000, currency: "LKR" },
    paymentType: "INTERIM",
    status: "PAID",
    date: new Date("2026-10-01T00:00:00.000Z"),
    createdBy: manager._id,
  });
  await ProjectPayment.create({
    projectId: mainProject._id,
    contractorId: company._id,
    amount: { amountMinor: 500000, currency: "LKR" },
    paymentType: "INTERIM",
    status: "PENDING",
    date: new Date("2026-10-02T00:00:00.000Z"),
    createdBy: manager._id,
  });
  await ProjectPayment.create({
    projectId: overrun._id,
    contractorId: company._id,
    amount: { amountMinor: 15000, currency: "LKR" },
    paymentType: "FINAL",
    status: "PAID",
    date: new Date("2026-10-03T00:00:00.000Z"),
    createdBy: manager._id,
  });
  await Inspection.create({ projectId: mainProject._id, inspectorId: inspector._id, inspectionDate: new Date("2026-11-02T00:00:00.000Z") });
  const milestone = await Milestone.create({
    projectId: mainProject._id,
    title: "Abutment works",
    plannedStart: new Date("2026-10-01T00:00:00.000Z"),
    plannedEnd: new Date("2026-12-01T00:00:00.000Z"),
    progress: 0,
    status: "NOT_STARTED",
  });
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        fixture: "synthetic-paid-rows-not-bank",
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        manager: manager.email,
        inspector: inspector.email,
        foreign: foreign.email,
        milestoneId: milestone._id.toString(),
        milestoneStatus: milestone.status,
        mainProjectId: mainProject._id.toString(),
        missingBudgetProjectId: missing._id.toString(),
        overrunProjectId: overrun._id.toString(),
        expectedPaidRatioPercent: 40,
        expectedOverrunRatioPercent: 150,
      },
      "step60 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step60 isolated dev failed");
  process.exit(1);
});
