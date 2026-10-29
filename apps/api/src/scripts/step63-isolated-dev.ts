/**
 * Disposable Mongo for the Step 63 browser demo.
 * Synthetic agencies and projects only. Does not read Atlas. Does not print the fixture password.
 */
import { hash } from "bcryptjs";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { Agency } from "../modules/agencies/models/agency.model.js";
import { AuditLog } from "../modules/audit/models/audit-log.model.js";
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

async function audit(action: string, resourceType: "PROJECT" | "MILESTONE", resourceId: unknown, at: string, userId: unknown, snapshot?: Record<string, unknown>) {
  const [row] = await AuditLog.create([{
    userId,
    action,
    resourceType,
    resourceId,
    newValue: snapshot,
    timestamp: new Date(at),
    requestId: "activity-demo",
  }]);
  if (!row) throw new Error("audit");
  if (row.timestamp?.toISOString() !== new Date(at).toISOString()) {
    await AuditLog.collection.updateOne({ _id: row._id }, { $set: { timestamp: new Date(at) } });
  }
}

async function main(): Promise<void> {
  env.ACCESS_TOKEN_SECRET = "access-secret-step63-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step63-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4017);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3007";
  await startIsolatedMongo();
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const other = await Agency.create({ code: "MIN_OTHER", name: "Other ministry", type: "MINISTRY", status: "ACTIVE" });
  const manager = await user("step63-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  const foreign = await user("step63-foreign@example.com", "AGENCY_OFFICER", other._id, "Foreign");
  const projectA = await project("INF-ACT-6301", "Synthetic activity road", child._id, manager._id, 100);
  const projectB = await project("INF-ACT-6302", "Synthetic visible prerequisite", child._id, manager._id);
  const foreignProject = await project("INF-ACT-6399", "Synthetic foreign project", other._id, foreign._id);
  const milestone = await Milestone.create({
    projectId: projectA._id,
    title: "Deck pour",
    plannedStart: new Date("2026-07-01T00:00:00.000Z"),
    plannedEnd: new Date("2026-08-01T00:00:00.000Z"),
    progress: 0,
    status: "DELAYED",
  });
  await ProgressReport.create({
    projectId: projectA._id,
    sequence: 1,
    reportedPercent: 100,
    previousPercent: 0,
    note: "Private recorded note",
    reporterUserId: manager._id,
    reportedAt: new Date("2026-07-03T00:00:01.000Z"),
  });
  await audit("project.created", "PROJECT", projectA._id, "2026-06-01T00:00:00.000Z", manager._id, { status: "DRAFT" });
  await audit("progress.reported", "PROJECT", projectA._id, "2026-07-03T00:00:00.000Z", manager._id, { physicalProgress: 100 });
  await audit("milestone.status_changed", "MILESTONE", milestone._id, "2026-07-04T00:00:00.000Z", manager._id, { status: "DELAYED" });
  await audit("project.dependency_linked", "PROJECT", projectA._id, "2026-07-05T00:00:00.000Z", manager._id, { prerequisiteProjectId: projectB._id });
  await audit("project.dependency_removed", "PROJECT", projectA._id, "2026-07-06T00:00:00.000Z", manager._id, { prerequisiteProjectId: foreignProject._id });
  for (let index = 0; index < 18; index += 1) {
    const day = String(index + 1).padStart(2, "0");
    await audit("project.updated", "PROJECT", projectA._id, `2026-08-${day}T00:00:00.000Z`, manager._id, { status: "ACTIVE" });
  }
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        fixture: "synthetic-activity-not-bank",
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        manager: manager.email,
        foreign: foreign.email,
        projectA: projectA._id.toString(),
        projectB: projectB._id.toString(),
        foreignProject: foreignProject._id.toString(),
      },
      "step63 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step63 isolated dev failed");
  process.exit(1);
});
