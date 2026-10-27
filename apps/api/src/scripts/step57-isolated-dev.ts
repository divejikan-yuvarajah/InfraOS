/**
 * Disposable Mongo + seeded staff for the Step 57 browser demo.
 * Does not read Atlas. Does not print the fixture password.
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
  env.ACCESS_TOKEN_SECRET = "access-secret-step57-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step57-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4011);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3001";
  await startIsolatedMongo();
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({
    code: "DEPT_WEST",
    name: "Western",
    type: "DEPARTMENT",
    status: "ACTIVE",
    parentAgencyId: ministry._id,
  });
  const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
  const officer = await user("step57-officer@example.com", "AGENCY_OFFICER", child._id, "Officer");
  const gov = await user("step57-gov@example.com", "GOV_ADMIN", ministry._id, "Reviewer");
  const approver = await user("step57-approver@example.com", "GOV_ADMIN", ministry._id, "Approver");
  const sod = await user("step57-sod@example.com", "GOV_ADMIN", ministry._id, "Submitter");
  await user("step57-foreign@example.com", "GOV_ADMIN", other._id, "Foreign");
  await user("step57-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  await user("step57-contractor@example.com", "CONTRACTOR", child._id, "Contractor");
  await user("step57-inspector@example.com", "INSPECTOR", child._id, "Inspector");
  await user("step57-citizen@example.com", "CITIZEN", child._id, "Citizen");
  await user("step57-super@example.com", "SUPER_ADMIN", ministry._id, "Super");

  const schedule = {
    location: { district: "Colombo", province: "Western", locality: "Fort" },
    geometry: { type: "Point", coordinates: [79.86, 6.93] },
    startDate: new Date("2027-01-01T00:00:00.000Z"),
    plannedEndDate: new Date("2027-06-01T00:00:00.000Z"),
    budget: { amountMinor: 150000000, currency: "LKR" as const },
    physicalProgress: 0,
    financialProgress: 0,
    projectType: "ROAD" as const,
    agencyId: child._id,
    createdBy: officer._id,
    description: "Disposable Step 57 record",
  };

  const live = await Project.create({
    ...schedule,
    projectCode: "INF-ROAD-5700",
    title: "Live submission road",
    status: "DRAFT",
  });

  const submittedIds: string[] = [];
  for (let index = 1; index <= 11; index += 1) {
    const code = `INF-ROAD-${5700 + index}`;
    const project = await Project.create({
      ...schedule,
      projectCode: code,
      title: index === 1 ? "Fort access road" : `Queued road ${code}`,
      status: "SUBMITTED",
    });
    await AuditLog.create({
      userId: officer._id,
      action: "project.submitted",
      resourceType: "PROJECT",
      resourceId: project._id,
      oldValue: { status: "DRAFT", agencyId: child._id },
      newValue: { status: "SUBMITTED", agencyId: child._id },
      requestId: `seed-submit-${code}`,
      agencyId: child._id,
    });
    submittedIds.push(project._id.toString());
  }

  const race = await Project.create({
    ...schedule,
    projectCode: "INF-ROAD-5790",
    title: "Concurrent review road",
    status: "SUBMITTED",
  });
  await AuditLog.create({
    userId: officer._id,
    action: "project.submitted",
    resourceType: "PROJECT",
    resourceId: race._id,
    oldValue: { status: "DRAFT", agencyId: child._id },
    newValue: { status: "SUBMITTED", agencyId: child._id },
    requestId: "seed-submit-race",
    agencyId: child._id,
  });

  const sodProject = await Project.create({
    ...schedule,
    projectCode: "INF-ROAD-5791",
    title: "Submitter cannot approve",
    status: "UNDER_REVIEW",
    createdBy: sod._id,
  });
  await AuditLog.create({
    userId: sod._id,
    action: "project.submitted",
    resourceType: "PROJECT",
    resourceId: sodProject._id,
    oldValue: { status: "DRAFT", agencyId: child._id },
    newValue: { status: "SUBMITTED", agencyId: child._id },
    requestId: "seed-submit-sod",
    agencyId: child._id,
  });

  await Project.create({
    ...schedule,
    projectCode: "INF-ROAD-5799",
    title: "Seeded approved display record",
    status: "APPROVED",
  });

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        officer: "step57-officer@example.com",
        gov: gov.email,
        approver: approver.email,
        sod: sod.email,
        foreign: "step57-foreign@example.com",
        manager: "step57-manager@example.com",
        liveProjectId: live._id.toString(),
        raceProjectId: race._id.toString(),
        sodProjectId: sodProject._id.toString(),
        queued: submittedIds.length,
      },
      "step57 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step57 isolated dev failed");
  process.exit(1);
});
