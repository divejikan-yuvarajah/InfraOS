import { hash } from "bcryptjs";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { financialProgressHooks } from "../src/modules/projects/financial-progress.service.js";
import { summarizeRecordedPayments } from "../src/modules/projects/financial-progress.policy.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const app = createApp();

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

async function actor(email: string, role: SystemRoleKey, agencyId: unknown) {
  const roleDoc = await Role.findOne({ key: role });
  if (!roleDoc) throw new Error("missing role");
  const user = await User.create({
    firstName: "Nimal",
    lastName: "Perera",
    email,
    passwordHash: await hash("correct-horse-battery", 4),
    roleId: roleDoc._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 1,
  });
  return { user, token: (await signAccessToken(user._id.toString(), 1)).token };
}

describe("recorded financial progress math", () => {
  it("uses only the supplied paid rows and refuses an empty budget or an unsafe sum", () => {
    expect(summarizeRecordedPayments(10000, [{ amountMinor: 10000, currency: "LKR" }])).toMatchObject({ availability: "provisional", ratioPercent: 100, overrunMinor: 0 });
    expect(summarizeRecordedPayments(10000, [{ amountMinor: 15000, currency: "LKR" }])).toMatchObject({ availability: "provisional", ratioPercent: 150, overrunMinor: 5000, remainingMinor: 0 });
    expect(summarizeRecordedPayments(0, [{ amountMinor: 100, currency: "LKR" }]).availability).toBe("unavailable");
    expect(summarizeRecordedPayments(undefined, []).availability).toBe("unavailable");
    expect(summarizeRecordedPayments(100, [{ amountMinor: 1, currency: "USD" }]).reason).toBe("mixed_currency");
    expect(summarizeRecordedPayments(100, [{ amountMinor: Number.MAX_SAFE_INTEGER, currency: "LKR" }, { amountMinor: Number.MAX_SAFE_INTEGER, currency: "LKR" }]).reason).toBe("unsafe_amount");
  });
});

describe("step 60 financial progress", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step60-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step60-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    financialProgressHooks.beforeRead = async () => {};
    await ProjectPayment.deleteMany({});
    await Contractor.deleteMany({});
    await Project.deleteMany({});
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
    await seedRoles();
    const ministry = await Agency.create({ code: "MIN_ROAD", name: "Roads", type: "MINISTRY", status: "ACTIVE" });
    const child = await Agency.create({ code: "DEPT_WEST", name: "Western", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
    const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
    const manager = await actor("pm60@example.com", "PROJECT_MANAGER", child._id);
    const payer = await actor("payer60@example.com", "AGENCY_OFFICER", child._id);
    const company = await Contractor.create({ name: "Synthetic Works", registrationNumber: "REG-60", status: "ACTIVE" });
    const project = await Project.create({
      projectCode: "INF-FIN-6001",
      title: "Finance summary road",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 10000, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 65,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    const otherProject = await Project.create({
      projectCode: "INF-FIN-6002",
      title: "Other road",
      projectType: "ROAD",
      agencyId: child._id,
      managerId: manager.user._id,
      budget: { amountMinor: 10000, currency: "LKR" },
      status: "ACTIVE",
      physicalProgress: 0,
      financialProgress: 0,
      createdBy: manager.user._id,
    });
    async function pay(target: typeof project, status: "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED", amountMinor: number, currency: "LKR" = "LKR") {
      await ProjectPayment.create({
        projectId: target._id,
        contractorId: company._id,
        amount: { amountMinor, currency },
        paymentType: "INTERIM",
        status,
        date: new Date("2026-10-01T00:00:00.000Z"),
        createdBy: payer.user._id,
      });
    }
    await pay(project, "PAID", 4000);
    await pay(project, "PENDING", 9000);
    await pay(project, "APPROVED", 9000);
    await pay(project, "REJECTED", 9000);
    await pay(project, "CANCELLED", 9000);
    await pay(otherProject, "PAID", 9000);
    return {
      project,
      otherProject,
      manager,
      payer,
      pay,
      foreign: await actor("foreign60@example.com", "GOV_ADMIN", other._id),
      contractor: await actor("contractor60@example.com", "CONTRACTOR", child._id),
      inspector: await actor("inspector60@example.com", "INSPECTOR", child._id),
      citizen: await actor("citizen60@example.com", "CITIZEN", child._id),
      superUser: await actor("super60@example.com", "SUPER_ADMIN", ministry._id),
    };
  }

  it("sums recorded PAID rows only and does not write the project cache", async () => {
    const data = await world();
    const response = await request(app).get(`/api/v1/projects/${data.project.id}/financial-progress`).set("Authorization", `Bearer ${data.manager.token}`);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data.summary).toMatchObject({
      availability: "provisional",
      basis: "recorded_paid_rows",
      currency: "LKR",
      budgetMinor: 10000,
      paidMinor: 4000,
      remainingMinor: 6000,
      overrunMinor: 0,
      ratioPercent: 40,
    });
    expect(response.body.data.summary.provenance).toContain("not a bank confirmation");
    expect(response.body.data.summary).not.toHaveProperty("financialProgress");
    expect(JSON.stringify(response.body)).not.toContain("createdBy");
    const stored = await Project.findById(data.project.id);
    expect(stored?.financialProgress).toBe(0);
    expect(stored?.physicalProgress).toBe(65);
    expect((await request(app).post(`/api/v1/projects/${data.project.id}/financial-progress`).set("Authorization", `Bearer ${data.manager.token}`).send({ financialProgress: 99 })).status).toBe(404);
  });

  it("hides money from roles without both finance reads and from other agencies", async () => {
    const data = await world();
    const id = data.project.id;
    expect((await request(app).get(`/api/v1/projects/${id}/financial-progress`)).status).toBe(401);
    for (const token of [data.contractor.token, data.inspector.token, data.citizen.token]) {
      const denied = await request(app).get(`/api/v1/projects/${id}/financial-progress`).set("Authorization", `Bearer ${token}`);
      expect(denied.status).toBe(403);
      expect(JSON.stringify(denied.body)).not.toContain("budgetMinor");
    }
    expect((await request(app).get(`/api/v1/projects/${id}/financial-progress`).set("Authorization", `Bearer ${data.foreign.token}`)).status).toBe(404);
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $pull: { permissions: "finance.payment.read" } });
    const budgetOnly = await request(app).get(`/api/v1/projects/${id}/financial-progress`).set("Authorization", `Bearer ${data.manager.token}`);
    expect(budgetOnly.status).toBe(403);
    expect(JSON.stringify(budgetOnly.body)).not.toContain("4000");
    await Role.updateOne({ key: "PROJECT_MANAGER" }, { $addToSet: { permissions: "finance.payment.read" } });
    const readable = await request(app).get(`/api/v1/projects/${id}/financial-progress`).set("Authorization", `Bearer ${data.superUser.token}`);
    expect(readable.status).toBe(200);
    expect(readable.body.data.summary.paidMinor).toBe(4000);
  });

  it("returns unavailable for a zero budget, mixed currency, or a failed read", async () => {
    const data = await world();
    await Project.updateOne({ _id: data.project._id }, { $set: { "budget.amountMinor": 0 } });
    const missing = await request(app).get(`/api/v1/projects/${data.project.id}/financial-progress`).set("Authorization", `Bearer ${data.manager.token}`);
    expect(missing.status).toBe(200);
    expect(missing.body.data.summary).toEqual({ availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "missing_budget" });
    expect(missing.body.data.summary).not.toHaveProperty("ratioPercent");
    await Project.updateOne({ _id: data.project._id }, { $set: { "budget.amountMinor": 10000 } });
    await data.pay(data.project, "PAID", 100, "LKR");
    await ProjectPayment.updateOne({ projectId: data.project._id, "amount.amountMinor": 100 }, { $set: { "amount.currency": "USD" } });
    const mixed = await request(app).get(`/api/v1/projects/${data.project.id}/financial-progress`).set("Authorization", `Bearer ${data.manager.token}`);
    expect(mixed.body.data.summary.reason).toBe("mixed_currency");
    expect(mixed.body.data.summary).not.toHaveProperty("paidMinor");
    financialProgressHooks.beforeRead = async () => {
      throw new Error("finance read down");
    };
    const down = await request(app).get(`/api/v1/projects/${data.project.id}/financial-progress`).set("Authorization", `Bearer ${data.manager.token}`);
    expect(down.status).toBe(503);
    expect(JSON.stringify(down.body)).not.toContain("ratioPercent");
    const stored = await Project.findById(data.project.id);
    expect(stored?.financialProgress).toBe(0);
  });
});
