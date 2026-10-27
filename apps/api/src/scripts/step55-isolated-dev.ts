/**
 * Disposable Mongo + seeded staff for Step 55 local browser demos.
 * Does not read Atlas. Stop any other API on the chosen port first.
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

const DEMO_EMAIL = "step55-officer@example.com";
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

async function main(): Promise<void> {
  env.ACCESS_TOKEN_SECRET = env.ACCESS_TOKEN_SECRET || "access-secret-step55-dev-only";
  env.REFRESH_TOKEN_SECRET = env.REFRESH_TOKEN_SECRET || "refresh-secret-step55-dev-only";
  env.PORT = Number(process.env.PORT ?? 4010);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
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
  const officerRole = await Role.findOne({ key: "AGENCY_OFFICER" });
  if (!officerRole) throw new Error("missing officer role");
  const officer = await User.create({
    firstName: "Step",
    lastName: "Officer",
    email: DEMO_EMAIL,
    passwordHash: await hash(DEMO_PASSWORD, 4),
    roleId: officerRole._id,
    agencyId: child._id,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 1,
  });
  const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
  const fixtureRoles = ["PROJECT_MANAGER", "CONTRACTOR", "INSPECTOR", "CITIZEN", "SUPER_ADMIN"] as const;
  for (const key of fixtureRoles) {
    const role = await Role.findOne({ key });
    if (!role) throw new Error(`missing ${key}`);
    await User.create({
      firstName: key,
      lastName: "Fixture",
      email: `step55-${key.toLowerCase().replace("_", "-")}@example.com`,
      passwordHash: await hash(DEMO_PASSWORD, 4),
      roleId: role._id,
      agencyId: key === "SUPER_ADMIN" ? ministry._id : child._id,
      status: "ACTIVE",
      emailVerified: true,
      credentialEpoch: 1,
    });
  }
  await User.create({
    firstName: "Other",
    lastName: "Officer",
    email: "step55-other@example.com",
    passwordHash: await hash(DEMO_PASSWORD, 4),
    roleId: officerRole._id,
    agencyId: other._id,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 1,
  });
  await Project.create({
    projectCode: "INF-ROAD-555",
    title: "Step 55 Demo Draft",
    description: "Editable disposable draft",
    projectType: "ROAD",
    agencyId: child._id,
    budget: { amountMinor: 100000, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "DRAFT",
    createdBy: officer._id,
  });
  await Project.create({
    projectCode: "INF-ROAD-556",
    title: "Step 56 Seeded Active",
    description: "Disposable active record for hold and resume only",
    projectType: "ROAD",
    agencyId: child._id,
    budget: { amountMinor: 100000, currency: "LKR" },
    physicalProgress: 0,
    financialProgress: 0,
    status: "ACTIVE",
    location: { district: "Colombo" },
    geometry: { type: "Point", coordinates: [79.86, 6.93] },
    startDate: new Date("2027-01-01T00:00:00.000Z"),
    plannedEndDate: new Date("2027-06-01T00:00:00.000Z"),
    createdBy: officer._id,
  });
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(
      {
        ready: true,
        port: env.PORT,
        loginEmail: DEMO_EMAIL,
        projects: "/projects",
        note: "Point NEXT_PUBLIC_API_BASE_URL at this port and restart dev:web. Use the API test fixture password.",
      },
      "step55 isolated dev ready",
    );
  });
}

main().catch((error: unknown) => {
  logger.error({ reason: error instanceof Error ? error.message : "unknown" }, "step55 isolated dev failed");
  process.exit(1);
});
