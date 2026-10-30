/**
 * Disposable Mongo for the Step 64 browser demo.
 * Synthetic agencies and projects only. Does not read Atlas. Does not print the fixture password.
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

async function project(code: string, title: string, agencyId: unknown, managerId: unknown, status: string, physicalProgress: number) {
  return Project.create({
    projectCode: code,
    title,
    projectType: "ROAD",
    agencyId,
    managerId,
    budget: { amountMinor: 1000000, currency: "LKR" },
    physicalProgress,
    financialProgress: 0,
    status,
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    plannedEndDate: new Date("2026-12-31T00:00:00.000Z"),
    createdBy: managerId,
  });
}

async function main(): Promise<void> {
  env.ACCESS_TOKEN_SECRET = "access-secret-step64-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step64-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4019);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3019";
  await startIsolatedMongo();
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const other = await Agency.create({ code: "MIN_OTHER", name: "Other ministry", type: "MINISTRY", status: "ACTIVE" });
  const manager = await user("step64-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  const officer = await user("step64-officer@example.com", "AGENCY_OFFICER", child._id, "Officer");
  const reviewer = await user("step64-reviewer@example.com", "GOV_ADMIN", ministry._id, "Reviewer");
  const foreign = await user("step64-foreign@example.com", "AGENCY_OFFICER", other._id, "Foreign");
  const reported = await project("INF-DASH-6401", "Reported complete road", child._id, manager._id, "ACTIVE", 100);
  await project("INF-DASH-6403", "Held drain", child._id, manager._id, "ON_HOLD", 0);
  await project("INF-DASH-6404", "Late pier", child._id, manager._id, "DELAYED", 0);
  await project("INF-DASH-6405", "Waiting approval", child._id, manager._id, "SUBMITTED", 0);
  await project("INF-DASH-6499", "Foreign road", other._id, foreign._id, "ACTIVE", 40);
  const company = await Contractor.create({ name: "Synthetic Works", registrationNumber: "REG64DEMO" });
  await ProjectPayment.create({
    projectId: reported._id,
    contractorId: company._id,
    amount: { amountMinor: 2500, currency: "LKR" },
    paymentType: "INTERIM",
    status: "PAID",
    date: new Date("2026-06-01T00:00:00.000Z"),
    createdBy: manager._id,
  });
  await Milestone.create({
    projectId: reported._id,
    title: "Overdue deck",
    plannedStart: new Date("2020-01-01T00:00:00.000Z"),
    plannedEnd: new Date("2020-02-01T00:00:00.000Z"),
    progress: 10,
    status: "IN_PROGRESS",
  });
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  await Milestone.create({
    projectId: reported._id,
    title: "Due approach",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedEnd: soon,
    progress: 0,
    status: "NOT_STARTED",
  });
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        fixture: "synthetic-dashboard-not-bank",
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        officer: officer.email,
        reviewer: reviewer.email,
        foreign: foreign.email,
        expectedOfficerTotal: 4,
        expectedActiveStillOpenAt100: 1,
        expectedForeignTotal: 1,
      },
      "step64 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step64 isolated dev failed");
  process.exit(1);
});
