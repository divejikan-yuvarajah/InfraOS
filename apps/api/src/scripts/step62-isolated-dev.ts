/**
 * Disposable Mongo for the Step 62 browser demo.
 * Synthetic agencies and projects only. Does not read Atlas. Does not print the fixture password.
 */
import { hash } from "bcryptjs";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { Agency } from "../modules/agencies/models/agency.model.js";
import { Role } from "../modules/identity/models/role.model.js";
import { User } from "../modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../modules/identity/seed/system-role-permissions.js";
import { Contractor } from "../modules/contractors/models/contractor.model.js";
import { ProjectPayment } from "../modules/finance/models/project-payment.model.js";
import { Milestone } from "../modules/projects/models/milestone.model.js";
import { ProgressReport } from "../modules/projects/models/progress-report.model.js";
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

async function project(code: string, title: string, agencyId: unknown, managerId: unknown, physicalProgress = 0) {
  return Project.create({
    projectCode: code,
    title,
    projectType: "ROAD",
    agencyId,
    managerId,
    budget: { amountMinor: 1000000, currency: "LKR" },
    physicalProgress,
    financialProgress: 0,
    status: "ACTIVE",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    plannedEndDate: new Date("2026-12-31T00:00:00.000Z"),
    createdBy: managerId,
  });
}

async function main(): Promise<void> {
  env.ACCESS_TOKEN_SECRET = "access-secret-step62-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step62-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4016);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3006";
  await startIsolatedMongo();
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const other = await Agency.create({ code: "MIN_OTHER", name: "Other ministry", type: "MINISTRY", status: "ACTIVE" });
  const manager = await user("step62-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  const foreign = await user("step62-foreign@example.com", "AGENCY_OFFICER", other._id, "Foreign");
  const projectA = await project("INF-DEP-6201", "Synthetic dependent road", child._id, manager._id, 100);
  const projectB = await project("INF-DEP-6202", "Synthetic prerequisite bridge", child._id, manager._id);
  const projectC = await project("INF-DEP-6203", "Synthetic third span", child._id, manager._id);
  const foreignProject = await project("INF-DEP-6299", "Synthetic foreign project", other._id, foreign._id);
  await Milestone.create({
    projectId: projectA._id,
    title: "Deck pour",
    plannedStart: new Date("2026-07-01T00:00:00.000Z"),
    plannedEnd: new Date("2026-08-01T00:00:00.000Z"),
    actualStart: new Date("2026-07-03T00:00:00.000Z"),
    progress: 0,
    status: "DELAYED",
  });
  await ProgressReport.create({
    projectId: projectA._id,
    sequence: 1,
    reportedPercent: 100,
    previousPercent: 0,
    note: "Reported deck placement, not an inspection",
    reporterUserId: manager._id,
    reportedAt: new Date("2026-07-01T18:30:00.000Z"),
  });
  const company = await Contractor.create({ name: "Synthetic Works", registrationNumber: "REG-62", status: "ACTIVE" });
  await ProjectPayment.create({
    projectId: projectA._id,
    contractorId: company._id,
    amount: { amountMinor: 400000, currency: "LKR" },
    paymentType: "INTERIM",
    status: "PAID",
    date: new Date("2026-10-01T00:00:00.000Z"),
    createdBy: manager._id,
  });
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        fixture: "synthetic-dependencies-not-bank",
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        manager: manager.email,
        foreign: foreign.email,
        projectA: projectA._id.toString(),
        projectB: projectB._id.toString(),
        projectC: projectC._id.toString(),
        foreignProject: foreignProject._id.toString(),
      },
      "step62 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step62 isolated dev failed");
  process.exit(1);
});
