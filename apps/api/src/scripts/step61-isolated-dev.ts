/**
 * Disposable Mongo for the Step 61 browser demo.
 * Dates and progress notes are synthetic. Does not read Atlas. Does not print the fixture password.
 */
import { hash } from "bcryptjs";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { Agency } from "../modules/agencies/models/agency.model.js";
import { Role } from "../modules/identity/models/role.model.js";
import { User } from "../modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../modules/identity/seed/system-role-permissions.js";
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

async function main(): Promise<void> {
  env.ACCESS_TOKEN_SECRET = "access-secret-step61-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step61-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4014);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3004";
  await startIsolatedMongo();
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const other = await Agency.create({ code: "MIN_OTHER", name: "Other ministry", type: "MINISTRY", status: "ACTIVE" });
  const manager = await user("step61-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  const foreign = await user("step61-foreign@example.com", "AGENCY_OFFICER", other._id, "Foreign");
  const mainProject = await Project.create({
    projectCode: "INF-TIME-6101",
    title: "Synthetic timeline road",
    projectType: "ROAD",
    agencyId: child._id,
    managerId: manager._id,
    budget: { amountMinor: 1000000, currency: "LKR" },
    physicalProgress: 40,
    financialProgress: 0,
    status: "ACTIVE",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    plannedEndDate: new Date("2026-12-31T00:00:00.000Z"),
    createdBy: manager._id,
  });
  const empty = await Project.create({
    projectCode: "INF-TIME-6102",
    title: "Synthetic empty timeline",
    projectType: "ROAD",
    agencyId: child._id,
    managerId: manager._id,
    budget: { amountMinor: 1000, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "CANCELLED",
    createdBy: manager._id,
  });
  const deck = await Milestone.create({
    projectId: mainProject._id,
    title: "Deck pour",
    plannedStart: new Date("2026-07-01T00:00:00.000Z"),
    plannedEnd: new Date("2026-08-01T00:00:00.000Z"),
    actualStart: new Date("2026-07-03T00:00:00.000Z"),
    progress: 0,
    status: "DELAYED",
  });
  const abutment = await Milestone.create({
    projectId: mainProject._id,
    title: "Abutment works",
    plannedStart: new Date("2026-07-01T00:00:00.000Z"),
    plannedEnd: new Date("2026-09-01T00:00:00.000Z"),
    progress: 0,
    status: "NOT_STARTED",
  });
  await ProgressReport.create({
    projectId: mainProject._id,
    sequence: 1,
    reportedPercent: 40,
    previousPercent: 0,
    note: "Reported deck placement, not an inspection",
    reporterUserId: manager._id,
    reportedAt: new Date("2026-07-01T18:30:00.000Z"),
  });
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        fixture: "synthetic-timeline-not-bank",
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        manager: manager.email,
        foreign: foreign.email,
        mainProjectId: mainProject._id.toString(),
        emptyProjectId: empty._id.toString(),
        deckId: deck._id.toString(),
        abutmentId: abutment._id.toString(),
        abutmentStatus: abutment.status,
      },
      "step61 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step61 isolated dev failed");
  process.exit(1);
});
