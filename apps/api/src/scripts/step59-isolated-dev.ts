/**
 * Disposable Mongo + seeded staff for the Step 59 browser demo.
 * The ACTIVE project is a fixture. It is not produced by the blocked START action.
 * Does not read Atlas. Does not print the fixture password.
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
  env.ACCESS_TOKEN_SECRET = "access-secret-step59-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-step59-dev-only-0123456789";
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
  const manager = await user("step59-manager@example.com", "PROJECT_MANAGER", child._id, "Manager");
  await user("step59-foreign@example.com", "GOV_ADMIN", other._id, "Foreign");
  await user("step59-contractor@example.com", "CONTRACTOR", child._id, "Contractor");
  const active = await Project.create({
    projectCode: "INF-ROAD-5901",
    title: "Synthetic active progress road",
    description: "Fixture ACTIVE project. Not started through project START.",
    projectType: "ROAD",
    agencyId: child._id,
    managerId: manager._id,
    budget: { amountMinor: 150000000, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "ACTIVE",
    createdBy: manager._id,
  });
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        fixture: "synthetic-active-not-started",
        port: env.PORT,
        origin: env.FRONTEND_ORIGIN,
        manager: manager.email,
        foreign: "step59-foreign@example.com",
        contractor: "step59-contractor@example.com",
        contractorMapping: "none",
        projectId: active._id.toString(),
        projectCode: active.projectCode,
        projectStatus: active.status,
        physicalProgress: active.physicalProgress,
      },
      "step59 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step59 isolated dev failed");
  process.exit(1);
});
