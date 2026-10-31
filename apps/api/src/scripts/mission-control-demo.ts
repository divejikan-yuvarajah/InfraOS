/**
 * Disposable, in-memory Mongo for the Mission Control UI demo.
 * Synthetic data only. Never reads Atlas. Data disappears when this process stops.
 * Local-only accounts; the shared fixture password is printed only as a reminder that it is a fixture.
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
import {
  SYSTEM_ROLE_META,
  SYSTEM_ROLE_PERMISSIONS,
} from "../modules/identity/seed/system-role-permissions.js";
import { Notification } from "../modules/notifications/models/notification.model.js";
import { Milestone } from "../modules/projects/models/milestone.model.js";
import { Project } from "../modules/projects/models/project.model.js";
import type { SystemRoleKey } from "@infraos/shared-types";
import { startIsolatedMongo } from "../../tests/helpers/mongo-memory.js";

const DEMO_PASSWORD = "correct-horse-battery";
const DAY = 24 * 60 * 60 * 1000;

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

async function user(
  email: string,
  roleKey: SystemRoleKey,
  agencyId: unknown,
  firstName: string,
  lastName: string,
) {
  const role = await Role.findOne({ key: roleKey });
  if (!role) throw new Error(`missing ${roleKey}`);
  return User.create({
    firstName,
    lastName,
    email,
    passwordHash: await hash(DEMO_PASSWORD, 4),
    roleId: role._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 1,
  });
}

async function project(
  code: string,
  title: string,
  agencyId: unknown,
  managerId: unknown,
  status: string,
  physicalProgress: number,
  financialProgress = 0,
) {
  return Project.create({
    projectCode: code,
    title,
    projectType: "ROAD",
    agencyId,
    managerId,
    budget: { amountMinor: 250000000, currency: "LKR" },
    physicalProgress,
    financialProgress,
    status,
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    plannedEndDate: new Date("2027-03-31T00:00:00.000Z"),
    location: { district: "Colombo", province: "Western" },
    geometry: { type: "Point", coordinates: [79.86, 6.93] },
    createdBy: managerId,
  });
}

async function signIn(email: string): Promise<string> {
  const response = await fetch(
    `http://localhost:${env.PORT}/api/v1/auth/login`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: env.FRONTEND_ORIGIN,
      },
      body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    },
  );
  const body = (await response.json()) as {
    data?: { accessToken?: string; session?: { accessToken?: string } };
  };
  const token = body.data?.accessToken ?? body.data?.session?.accessToken;
  if (!response.ok || !token)
    throw new Error(`demo sign-in failed for ${email}`);
  return token;
}

async function call(
  token: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `http://localhost:${env.PORT}/api/v1/projects/${path}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        origin: env.FRONTEND_ORIGIN,
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok)
    throw new Error(`demo step ${path} failed with ${response.status}`);
}

async function revisionOf(id: unknown): Promise<number> {
  const doc = await Project.findById(id).select("__v").lean();
  return doc?.__v ?? 0;
}

async function main(): Promise<void> {
  env.ACCESS_TOKEN_SECRET = "access-secret-mission-control-dev-only-0123456789";
  env.REFRESH_TOKEN_SECRET =
    "refresh-secret-mission-control-dev-only-0123456789";
  env.PORT = Number(process.env.PORT ?? 4000);
  env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3020";
  await startIsolatedMongo();
  await seedRoles();

  const ministry = await Agency.create({
    code: "MIN_ROAD",
    name: "Ministry of Highways (synthetic)",
    type: "MINISTRY",
    status: "ACTIVE",
  });
  const west = await Agency.create({
    code: "DEPT_WEST",
    name: "Western Roads Department (synthetic)",
    type: "DEPARTMENT",
    status: "ACTIVE",
    parentAgencyId: ministry._id,
  });
  const other = await Agency.create({
    code: "MIN_OTHER",
    name: "Ministry of Water Supply (synthetic)",
    type: "MINISTRY",
    status: "ACTIVE",
  });

  const admin = await user(
    "mc-admin@example.com",
    "SUPER_ADMIN",
    ministry._id,
    "Super",
    "Admin",
  );
  const gov = await user(
    "mc-gov@example.com",
    "GOV_ADMIN",
    ministry._id,
    "Government",
    "Admin",
  );
  const officer = await user(
    "mc-officer@example.com",
    "AGENCY_OFFICER",
    west._id,
    "Agency",
    "Officer",
  );
  const manager = await user(
    "mc-manager@example.com",
    "PROJECT_MANAGER",
    west._id,
    "Project",
    "Manager",
  );
  const foreign = await user(
    "mc-foreign@example.com",
    "AGENCY_OFFICER",
    other._id,
    "Foreign",
    "Officer",
  );

  const colombo = await project(
    "INF-MCD-0001",
    "Colombo Drainage Upgrade with a deliberately long title to test wrapping",
    west._id,
    manager._id,
    "ACTIVE",
    62,
    48,
  );
  await project(
    "INF-MCD-0002",
    "Kelani Bridge Rehabilitation",
    west._id,
    manager._id,
    "DELAYED",
    35,
    40,
  );
  await project(
    "INF-MCD-0003",
    "Held drainage culvert",
    west._id,
    manager._id,
    "ON_HOLD",
    10,
    5,
  );
  await project(
    "INF-MCD-0004",
    "Galle Road Resurfacing",
    west._id,
    manager._id,
    "COMPLETED",
    100,
    100,
  );
  await project(
    "INF-MCD-0005",
    "Reported-complete pier works",
    west._id,
    manager._id,
    "ACTIVE",
    100,
    90,
  );
  // Created as DRAFT; moved through the real submit/review endpoints below so the audit trail is genuine.
  const review1 = await project(
    "INF-MCD-0006",
    "Waiting approval: Negombo access road",
    west._id,
    manager._id,
    "DRAFT",
    0,
  );
  await project(
    "INF-MCD-0007",
    "Draft: Kandy culvert survey",
    west._id,
    manager._id,
    "DRAFT",
    0,
  );
  const submitted = await project(
    "INF-MCD-0008",
    "Submitted: Panadura footbridge",
    west._id,
    manager._id,
    "DRAFT",
    0,
  );
  await project(
    "INF-MCD-9001",
    "Other ministry road (must be isolated)",
    other._id,
    foreign._id,
    "ACTIVE",
    40,
    20,
  );

  const company = await Contractor.create({
    name: "Synthetic Works Ltd",
    registrationNumber: "REGMCDEMO",
  });
  await ProjectPayment.create({
    projectId: colombo._id,
    contractorId: company._id,
    amount: { amountMinor: 1250000, currency: "LKR" },
    paymentType: "INTERIM",
    status: "PAID",
    date: new Date("2026-06-01T00:00:00.000Z"),
    createdBy: manager._id,
  });
  await Milestone.create({
    projectId: colombo._id,
    title: "Overdue culvert deck",
    plannedStart: new Date("2026-01-01T00:00:00.000Z"),
    plannedEnd: new Date("2026-02-01T00:00:00.000Z"),
    progress: 10,
    status: "IN_PROGRESS",
  });
  await Milestone.create({
    projectId: colombo._id,
    title: "Approach slab pour",
    plannedStart: new Date("2026-06-01T00:00:00.000Z"),
    plannedEnd: new Date(Date.now() + 5 * DAY),
    progress: 0,
    status: "NOT_STARTED",
  });

  await Notification.create({
    userId: gov._id,
    type: "APPROVAL",
    title: "project.submitted",
    message: "project.submitted",
    resourceType: "PROJECT",
    resourceId: review1._id,
  });
  await Notification.create({
    userId: gov._id,
    type: "APPROVAL",
    title: "project.submitted",
    message: "project.submitted",
    resourceType: "PROJECT",
    resourceId: colombo._id,
    isRead: true,
    readAt: new Date(),
  });
  await Notification.create({
    userId: manager._id,
    type: "APPROVAL",
    title: "project.returned",
    message: "project.returned",
    resourceType: "PROJECT",
    resourceId: colombo._id,
  });

  const app = createApp();
  await new Promise<void>((resolve) => {
    app.listen(env.PORT, () => resolve());
  });
  const managerToken = await signIn("mc-manager@example.com");
  for (const item of [review1, submitted]) {
    await call(managerToken, `${String(item._id)}/transition`, {
      action: "SUBMIT",
      revision: await revisionOf(item._id),
    });
  }
  const govToken = await signIn("mc-gov@example.com");
  await call(govToken, `${String(review1._id)}/review`, {
    action: "BEGIN_REVIEW",
    revision: await revisionOf(review1._id),
  });
  logger.info(
    {
      ready: true,
      fixture: "synthetic-mission-control-demo",
      storage: "in-memory-temporary",
      port: env.PORT,
      origin: env.FRONTEND_ORIGIN,
      accounts: {
        superAdmin: admin.email,
        govAdmin: gov.email,
        agencyOfficer: officer.email,
        projectManager: manager.email,
        foreignAgencyOfficer: foreign.email,
      },
    },
    "mission control demo ready",
  );
}

main().catch((error: unknown) => {
  logger.error(
    { reason: error instanceof Error ? error.message : "unknown" },
    "mission control demo failed",
  );
  process.exit(1);
});
