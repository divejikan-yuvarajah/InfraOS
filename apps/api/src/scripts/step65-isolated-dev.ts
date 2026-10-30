/**
 * Disposable Mongo for the Step 65 browser demo.
 * Synthetic records only. Does not read Atlas. Does not print the fixture password.
 */
import { hash } from "bcryptjs";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";
import { Agency } from "../modules/agencies/models/agency.model.js";
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
  env.ACCESS_TOKEN_SECRET = "access-secret-step65-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step65-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4020);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3020";
  await startIsolatedMongo();
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const other = await Agency.create({ code: "MIN_OTHER", name: "Other ministry", type: "MINISTRY", status: "ACTIVE" });
  const manager = await user("step65-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  const reviewer = await user("step65-reviewer@example.com", "GOV_ADMIN", ministry._id, "Reviewer");
  const foreign = await user("step65-foreign@example.com", "AGENCY_OFFICER", other._id, "Foreign");
  const draft = await Project.create({
    projectCode: "INF-NOTE-6501",
    title: "Synthetic notice road",
    projectType: "ROAD",
    agencyId: child._id,
    managerId: manager._id,
    budget: { amountMinor: 1000000, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "DRAFT",
    startDate: new Date("2027-01-01T00:00:00.000Z"),
    plannedEndDate: new Date("2027-06-01T00:00:00.000Z"),
    location: { district: "Colombo", province: "Western" },
    geometry: { type: "Point", coordinates: [79.86, 6.93] },
    createdBy: manager._id,
  });
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        fixture: "synthetic-notices-not-email",
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        manager: manager.email,
        reviewer: reviewer.email,
        foreign: foreign.email,
        projectId: draft._id.toString(),
        revision: draft.__v ?? 0,
      },
      "step65 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step65 isolated dev failed");
  process.exit(1);
});
