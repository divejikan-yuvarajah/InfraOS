import { hash } from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { Document } from "../src/modules/documents/models/document.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { readCitizenIssue, readConflict, readCoordination } from "../src/modules/identity/authorization/resource-scope.js";
import { CoordinationRequest } from "../src/modules/roadsync/models/coordination-request.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import {
  SYSTEM_ROLE_META,
  SYSTEM_ROLE_PERMISSIONS,
} from "../src/modules/identity/seed/system-role-permissions.js";
import { CitizenIssue } from "../src/modules/issues/models/citizen-issue.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { Notification } from "../src/modules/notifications/models/notification.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Conflict } from "../src/modules/roadsync/models/conflict.model.js";
import { WorkRequest } from "../src/modules/roadsync/models/work-request.model.js";
import type { SystemRoleKey } from "@infraos/shared-types";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import { createPermissionHarness } from "./helpers/permission-harness.js";
import { createScopeHarness } from "./helpers/scope-harness.js";

const ACCESS = "access-secret-step46-0123456789abcdef";
const REFRESH = "refresh-secret-step46-0123456789abcdef";
const harness = createScopeHarness();
const permissionHarness = createPermissionHarness();
const point = { type: "Point" as const, coordinates: [79.86, 6.92] as [number, number] };

async function roleFor(roleKey: SystemRoleKey) {
  const meta = SYSTEM_ROLE_META[roleKey];
  return (
    (await Role.findOne({ key: roleKey })) ??
    Role.create({
      key: roleKey,
      name: meta.name,
      description: meta.description,
      permissions: [...SYSTEM_ROLE_PERMISSIONS[roleKey]],
      scopeType: meta.scopeType,
      isActive: true,
    })
  );
}

async function userFor(roleKey: SystemRoleKey, email: string, agencyId: mongoose.Types.ObjectId) {
  const role = await roleFor(roleKey);
  const user = await User.create({
    firstName: "Nila",
    lastName: "Perera",
    email,
    passwordHash: await hash("correct-horse-battery", 4),
    roleId: role._id,
    agencyId,
    status: "ACTIVE",
    emailVerified: true,
    credentialEpoch: 0,
  });
  const token = (await signAccessToken(user._id.toString(), 0)).token;
  return { role, user, token };
}

async function projectFor(input: {
  code: string;
  agencyId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  managerId?: mongoose.Types.ObjectId;
  contractorId?: mongoose.Types.ObjectId;
  status?: string;
}) {
  return Project.create({
    projectCode: input.code,
    title: input.code,
    projectType: "ROAD",
    agencyId: input.agencyId,
    managerId: input.managerId,
    contractorId: input.contractorId,
    budget: { amountMinor: 1000, currency: "LKR" },
    createdBy: input.createdBy,
    status: input.status ?? "DRAFT",
  });
}

describe("step 46 resource scope", { timeout: 90_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    env.ACCESS_TOKEN_SECRET = ACCESS;
    env.REFRESH_TOKEN_SECRET = REFRESH;
    vi.restoreAllMocks();
    await Promise.all([
      Project.deleteMany({}),
      Document.deleteMany({}),
      Inspection.deleteMany({}),
      WorkRequest.deleteMany({}),
      Conflict.deleteMany({}),
      CoordinationRequest.deleteMany({}),
      ProjectPayment.deleteMany({}),
      Notification.deleteMany({}),
      CitizenIssue.deleteMany({}),
      Contractor.deleteMany({}),
    ]);
    await clearCoreCollections();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("isolates agencies, assignments, documents, notifications, and injected filters", async () => {
    const ministry = await Agency.create({ code: "MIN_A", name: "Ministry A", type: "MINISTRY", status: "ACTIVE" });
    const road = await Agency.create({ code: "ROAD_A", name: "Road", type: "ROAD", status: "ACTIVE", parentAgencyId: ministry._id });
    const water = await Agency.create({ code: "WATER_A", name: "Water", type: "WATER", status: "ACTIVE", parentAgencyId: ministry._id });
    const other = await Agency.create({ code: "MIN_B", name: "Ministry B", type: "MINISTRY", status: "ACTIVE" });
    const officer = await userFor("AGENCY_OFFICER", "road-officer@example.com", road._id);
    const manager = await userFor("PROJECT_MANAGER", "road-manager@example.com", road._id);
    const otherOfficer = await userFor("AGENCY_OFFICER", "other-officer@example.com", other._id);
    const own = await projectFor({ code: "INF-ROAD-1", agencyId: road._id, createdBy: officer.user._id, managerId: manager.user._id });
    const sameAgency = await projectFor({ code: "INF-ROAD-2", agencyId: road._id, createdBy: officer.user._id });
    const foreign = await projectFor({ code: "INF-WAT-1", agencyId: water._id, createdBy: officer.user._id });
    const outside = await projectFor({ code: "INF-TEL-1", agencyId: other._id, createdBy: otherOfficer.user._id });

    const anon = await request(harness).get(`/harness/projects/${own._id.toString()}`);
    expect(anon.status).toBe(401);

    const noGrant = await request(harness)
      .patch(`/harness/projects/${own._id.toString()}`)
      .set("Authorization", `Bearer ${(await userFor("CITIZEN", "citizen-scope@example.com", road._id)).token}`)
      .send({ title: "Changed" });
    expect(noGrant.status).toBe(403);

    const allowed = await request(harness)
      .get(`/harness/projects/${own._id.toString()}`)
      .set("Authorization", `Bearer ${officer.token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.agencyId).toBe(road._id.toString());
    expect(allowed.body.data.budget).toBeUndefined();

    const hidden = await request(harness)
      .get(`/harness/projects/${foreign._id.toString()}`)
      .set("Authorization", `Bearer ${officer.token}`);
    const missing = await request(harness)
      .get(`/harness/projects/${new mongoose.Types.ObjectId().toString()}`)
      .set("Authorization", `Bearer ${officer.token}`);
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(hidden.body.error.code).toBe(missing.body.error.code);
    expect(hidden.body.error.message).toBe(missing.body.error.message);
    expect((await request(harness).get("/harness/projects/not-an-id").set("Authorization", `Bearer ${officer.token}`)).status).toBe(400);

    const readSame = await request(harness)
      .get(`/harness/projects/${sameAgency._id.toString()}`)
      .set("Authorization", `Bearer ${manager.token}`);
    expect(readSame.status).toBe(200);
    const writeOwn = await request(harness)
      .patch(`/harness/projects/${own._id.toString()}`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ title: "Assigned edit", agencyId: water._id.toString() });
    expect(writeOwn.status).toBe(200);
    expect((await Project.findById(own._id))?.agencyId.toString()).toBe(road._id.toString());
    const writeOther = await request(harness)
      .patch(`/harness/projects/${sameAgency._id.toString()}`)
      .set("Authorization", `Bearer ${manager.token}`)
      .send({ title: "Not mine" });
    expect(writeOther.status).toBe(404);

    const injected = await request(harness)
      .get("/harness/projects")
      .query({ agencyId: water._id.toString(), $or: JSON.stringify([{ agencyId: water._id.toString() }]) })
      .set("Authorization", `Bearer ${officer.token}`);
    expect(injected.status).toBe(400);
    const listed = await request(harness).get("/harness/projects").set("Authorization", `Bearer ${officer.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.total).toBe(2);
    expect(listed.body.data.projects.map((item: { id: string }) => item.id).sort()).toEqual(
      [own._id.toString(), sameAgency._id.toString()].sort(),
    );
    const spoofed = await request(harness)
      .get("/harness/projects")
      .set("Authorization", `Bearer ${officer.token}`)
      .send({ roleKey: "SUPER_ADMIN", agencyId: water._id.toString(), permissions: ["*"], userId: otherOfficer.user._id.toString() });
    expect(spoofed.status).toBe(200);
    expect(spoofed.body.data.total).toBe(2);
    const managerList = await request(harness).get("/harness/projects").set("Authorization", `Bearer ${manager.token}`);
    expect(managerList.body.data.total).toBe(2);

    const gov = await userFor("GOV_ADMIN", "gov-scope@example.com", ministry._id);
    const govList = await request(harness).get("/harness/projects").set("Authorization", `Bearer ${gov.token}`);
    expect(govList.body.data.total).toBe(3);
    expect(govList.body.data.projects.some((item: { id: string }) => item.id === outside._id.toString())).toBe(false);

    const document = await Document.create({
      projectId: foreign._id,
      documentType: "OTHER",
      fileName: "secret.pdf",
      storageKey: "private/secret",
      storageUrl: "https://files.example/secret",
      uploadedBy: officer.user._id,
      visibility: "INTERNAL",
    });
    const doc = await request(harness)
      .get(`/harness/documents/${document._id.toString()}`)
      .set("Authorization", `Bearer ${officer.token}`);
    expect(doc.status).toBe(404);
    expect(JSON.stringify(doc.body)).not.toContain("private/secret");
    expect(JSON.stringify(doc.body)).not.toContain("storageUrl");
    const visibleDocument = await Document.create({
      projectId: own._id,
      documentType: "OTHER",
      fileName: "road.pdf",
      storageKey: "private/road",
      storageUrl: "https://files.example/road",
      uploadedBy: officer.user._id,
      visibility: "INTERNAL",
    });
    const visible = await request(harness)
      .get(`/harness/documents/${visibleDocument._id.toString()}`)
      .set("Authorization", `Bearer ${officer.token}`);
    expect(visible.status).toBe(200);
    expect(visible.body.data).toEqual({
      id: visibleDocument._id.toString(),
      fileName: "road.pdf",
      visibility: "INTERNAL",
      projectId: own._id.toString(),
    });

    const notice = await Notification.create({
      userId: otherOfficer.user._id,
      type: "SYSTEM",
      title: "Other inbox",
      message: "private",
    });
    const inbox = await request(harness)
      .get(`/harness/notifications/${notice._id.toString()}`)
      .set("Authorization", `Bearer ${officer.token}`);
    expect(inbox.status).toBe(404);
    expect(JSON.stringify(inbox.body)).not.toContain("private");

    officer.user.agencyId = water._id;
    await officer.user.save();
    expect(
      (await request(harness).get(`/harness/projects/${own._id.toString()}`).set("Authorization", `Bearer ${officer.token}`)).status,
    ).toBe(404);
  });

  it("scopes inspectors, conflicts, payments, and contractor links that the model cannot prove", async () => {
    const road = await Agency.create({ code: "ROAD_I", name: "Road", type: "ROAD", status: "ACTIVE" });
    const water = await Agency.create({ code: "WATER_I", name: "Water", type: "WATER", status: "ACTIVE" });
    const inspector = await userFor("INSPECTOR", "inspector-scope@example.com", road._id);
    const otherInspector = await userFor("INSPECTOR", "other-inspector@example.com", road._id);
    const officer = await userFor("AGENCY_OFFICER", "conflict-officer@example.com", road._id);
    const strangerAgency = await Agency.create({ code: "TEL_I", name: "Telecom", type: "DEPARTMENT", status: "ACTIVE" });
    const stranger = await userFor("AGENCY_OFFICER", "stranger-officer@example.com", strangerAgency._id);
    const approver = await userFor("GOV_ADMIN", "approver-scope@example.com", road._id);
    const maker = await projectFor({ code: "INF-ROAD-3", agencyId: road._id, createdBy: officer.user._id });
    const assigned = await Inspection.create({
      projectId: maker._id,
      inspectorId: inspector.user._id,
      inspectionDate: new Date("2026-10-01T00:00:00.000Z"),
    });
    const otherInspection = await Inspection.create({
      projectId: maker._id,
      inspectorId: otherInspector.user._id,
      inspectionDate: new Date("2026-10-02T00:00:00.000Z"),
    });
    expect(
      (await request(harness).get(`/harness/inspections/${assigned._id.toString()}`).set("Authorization", `Bearer ${inspector.token}`)).status,
    ).toBe(200);
    expect(
      (await request(harness).get(`/harness/inspections/${otherInspection._id.toString()}`).set("Authorization", `Bearer ${inspector.token}`)).status,
    ).toBe(404);
    expect(
      (await request(harness).get(`/harness/projects/${maker._id.toString()}`).set("Authorization", `Bearer ${inspector.token}`)).status,
    ).toBe(200);

    const roadRequest = await WorkRequest.create({
      projectId: maker._id,
      agencyId: road._id,
      geometry: point,
      workType: "ROAD_EXCAVATION",
      plannedStart: new Date("2026-10-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-10-03T00:00:00.000Z"),
    });
    const waterProject = await projectFor({ code: "INF-WAT-2", agencyId: water._id, createdBy: stranger.user._id });
    const waterRequest = await WorkRequest.create({
      projectId: waterProject._id,
      agencyId: water._id,
      geometry: point,
      workType: "PIPELINE_INSTALLATION",
      plannedStart: new Date("2026-10-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-10-04T00:00:00.000Z"),
    });
    const conflict = await Conflict.create({
      workRequestA: roadRequest._id,
      workRequestB: waterRequest._id,
      conflictType: "SCHEDULE_OVERLAP",
      scheduleOverlap: true,
      severity: "MEDIUM",
    });
    expect(
      (await request(harness).get(`/harness/conflicts/${conflict._id.toString()}`).set("Authorization", `Bearer ${officer.token}`)).status,
    ).toBe(200);
    const ignoredIds = await request(harness)
      .get(`/harness/conflicts/${conflict._id.toString()}`)
      .query({ workRequestA: waterRequest._id.toString() })
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(ignoredIds.status).toBe(404);
    const coordination = await CoordinationRequest.create({
      conflictId: conflict._id,
      fromAgency: road._id,
      toAgency: water._id,
      message: "Shift the excavation",
    });
    const roadActor = {
      userId: officer.user._id.toString(),
      roleId: officer.role._id.toString(),
      roleKey: "AGENCY_OFFICER" as const,
      agencyId: road._id.toString(),
      credentialEpoch: 0,
    };
    expect((await readCoordination(roadActor, coordination._id.toString())).ok).toBe(true);
    expect(
      (
        await readCoordination(
          { ...roadActor, userId: stranger.user._id.toString(), roleId: stranger.role._id.toString(), agencyId: strangerAgency._id.toString() },
          coordination._id.toString(),
        )
      ).ok,
    ).toBe(false);

    const contractor = await Contractor.create({
      name: "Build Co",
      registrationNumber: "REG-46",
      contact: { email: "contractor-scope@example.com" },
    });
    const contracted = await projectFor({
      code: "INF-ROAD-4",
      agencyId: road._id,
      createdBy: officer.user._id,
      contractorId: contractor._id,
    });
    const contractorUser = await userFor("CONTRACTOR", "contractor-scope@example.com", road._id);
    expect(
      (await request(harness).get(`/harness/projects/${contracted._id.toString()}`).set("Authorization", `Bearer ${contractorUser.token}`)).status,
    ).toBe(404);

    const payment = await ProjectPayment.create({
      projectId: maker._id,
      contractorId: contractor._id,
      amount: { amountMinor: 500, currency: "LKR" },
      paymentType: "INTERIM",
      status: "PENDING",
      date: new Date("2026-10-05T00:00:00.000Z"),
      createdBy: officer.user._id,
    });
    const selfApprove = await request(harness)
      .post(`/harness/payments/${payment._id.toString()}/approve`)
      .set("Authorization", `Bearer ${officer.token}`);
    expect(selfApprove.status).toBe(403);
    expect((await ProjectPayment.findById(payment._id))?.status).toBe("PENDING");
    const ownPayment = await ProjectPayment.create({
      projectId: maker._id,
      contractorId: contractor._id,
      amount: { amountMinor: 700, currency: "LKR" },
      paymentType: "FINAL",
      status: "PENDING",
      date: new Date("2026-10-06T00:00:00.000Z"),
      createdBy: approver.user._id,
    });
    const sod = await request(harness)
      .post(`/harness/payments/${ownPayment._id.toString()}/approve`)
      .set("Authorization", `Bearer ${approver.token}`);
    expect(sod.status).toBe(409);
    expect((await ProjectPayment.findById(ownPayment._id))?.status).toBe("PENDING");
    const approved = await request(harness)
      .post(`/harness/payments/${payment._id.toString()}/approve`)
      .set("Authorization", `Bearer ${approver.token}`);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("APPROVED");
    const secondApprover = await userFor("GOV_ADMIN", "approver-two@example.com", road._id);
    const racePayment = await ProjectPayment.create({
      projectId: maker._id,
      contractorId: contractor._id,
      amount: { amountMinor: 900, currency: "LKR" },
      paymentType: "ADVANCE",
      status: "PENDING",
      date: new Date("2026-10-07T00:00:00.000Z"),
      createdBy: officer.user._id,
    });
    const raced = await Promise.all([
      request(harness).post(`/harness/payments/${racePayment._id.toString()}/approve`).set("Authorization", `Bearer ${approver.token}`),
      request(harness).post(`/harness/payments/${racePayment._id.toString()}/approve`).set("Authorization", `Bearer ${secondApprover.token}`),
    ]);
    expect(raced.map((item) => item.status).sort()).toEqual([200, 409]);
    expect((await ProjectPayment.findById(racePayment._id))?.status).toBe("APPROVED");

    maker.status = "SUBMITTED";
    await maker.save();
    const illegal = await request(harness)
      .patch(`/harness/projects/${maker._id.toString()}`)
      .set("Authorization", `Bearer ${officer.token}`)
      .send({ title: "After submit" });
    expect(illegal.status).toBe(409);
    expect((await Project.findById(maker._id))?.title).toBe("INF-ROAD-3");

    const owner = await userFor("CITIZEN", "issue-owner@example.com", road._id);
    const issue = await CitizenIssue.create({
      citizenId: owner.user._id,
      category: "POTHOLE",
      description: "Hole",
      location: { district: "Colombo" },
      geometry: point,
      assignedAgency: road._id,
    });
    expect(
      (
        await readCitizenIssue(
          {
            userId: contractorUser.user._id.toString(),
            roleId: contractorUser.role._id.toString(),
            roleKey: "CONTRACTOR",
            agencyId: road._id.toString(),
            credentialEpoch: 0,
          },
          issue._id.toString(),
        )
      ).ok,
    ).toBe(false);
    const ownIssue = await readCitizenIssue(
      {
        userId: owner.user._id.toString(),
        roleId: owner.role._id.toString(),
        roleKey: "CITIZEN",
        agencyId: road._id.toString(),
        credentialEpoch: 0,
      },
      issue._id.toString(),
    );
    expect(ownIssue.ok).toBe(true);
    expect(JSON.stringify(ownIssue)).not.toContain("storageKey");
  });

  it("fails closed for super-admin operations, broken hierarchies, and database errors", async () => {
    const ministry = await Agency.create({ code: "MIN_C", name: "Ministry C", type: "MINISTRY", status: "ACTIVE" });
    const road = await Agency.create({ code: "ROAD_C", name: "Road C", type: "ROAD", status: "ACTIVE", parentAgencyId: ministry._id });
    const admin = await userFor("SUPER_ADMIN", "super-scope@example.com", ministry._id);
    const project = await projectFor({ code: "INF-ROAD-5", agencyId: road._id, createdBy: admin.user._id });
    expect(
      (await request(harness).get(`/harness/projects/${project._id.toString()}`).set("Authorization", `Bearer ${admin.token}`)).status,
    ).toBe(200);
    expect(
      (await request(harness).patch(`/harness/projects/${project._id.toString()}`).set("Authorization", `Bearer ${admin.token}`).send({ title: "No" })).status,
    ).toBe(403);

    const outside = await Agency.create({ code: "TEL_C", name: "Telecom C", type: "DEPARTMENT", status: "ACTIVE" });
    const third = await Agency.create({ code: "ELEC_C", name: "Power C", type: "DEPARTMENT", status: "ACTIVE" });
    const roadRequest = await WorkRequest.create({
      projectId: project._id,
      agencyId: road._id,
      geometry: point,
      workType: "ROAD_EXCAVATION",
      plannedStart: new Date("2026-11-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-11-03T00:00:00.000Z"),
    });
    const outsideProject = await projectFor({ code: "INF-TEL-5", agencyId: outside._id, createdBy: admin.user._id });
    const outsideRequest = await WorkRequest.create({
      projectId: outsideProject._id,
      agencyId: outside._id,
      geometry: point,
      workType: "TELECOM_CABLE_WORK",
      plannedStart: new Date("2026-11-01T00:00:00.000Z"),
      plannedEnd: new Date("2026-11-04T00:00:00.000Z"),
    });
    const conflict = await Conflict.create({
      workRequestA: roadRequest._id,
      workRequestB: outsideRequest._id,
      conflictType: "SCHEDULE_OVERLAP",
      scheduleOverlap: true,
      severity: "MEDIUM",
    });
    const platformRead = await request(harness)
      .get(`/harness/conflicts/${conflict._id.toString()}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(platformRead.status).toBe(200);
    expect(platformRead.body.data).toEqual({ id: conflict._id.toString(), status: "OPEN" });
    const gov = await userFor("GOV_ADMIN", "gov-conflict@example.com", ministry._id);
    expect(
      (await request(harness).get(`/harness/conflicts/${conflict._id.toString()}`).set("Authorization", `Bearer ${gov.token}`)).status,
    ).toBe(404);
    const party = await userFor("AGENCY_OFFICER", "telecom-party@example.com", outside._id);
    expect(
      (await request(harness).get(`/harness/conflicts/${conflict._id.toString()}`).set("Authorization", `Bearer ${party.token}`)).status,
    ).toBe(200);
    const bystander = await userFor("AGENCY_OFFICER", "power-bystander@example.com", third._id);
    expect(
      (await request(harness).get(`/harness/conflicts/${conflict._id.toString()}`).set("Authorization", `Bearer ${bystander.token}`)).status,
    ).toBe(404);
    for (const path of ["/harness/conflict-resolve", "/harness/project-approve", "/harness/payment-approve", "/harness/inspection-verify"]) {
      const denied = await request(permissionHarness).get(path).set("Authorization", `Bearer ${admin.token}`);
      expect(denied.status).toBe(403);
    }
    expect((await Conflict.findById(conflict._id))?.status).toBe("OPEN");
    admin.role.permissions = admin.role.permissions.filter((item) => item !== "roadsync.conflict.read");
    await admin.role.save();
    const revoked = await request(harness)
      .get(`/harness/conflicts/${conflict._id.toString()}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(revoked.status).toBe(403);
    const direct = await readConflict(
      {
        userId: admin.user._id.toString(),
        roleId: admin.role._id.toString(),
        roleKey: "SUPER_ADMIN",
        agencyId: ministry._id.toString(),
        credentialEpoch: 0,
      },
      conflict._id.toString(),
    );
    expect(direct.ok).toBe(false);
    admin.role.permissions = [...SYSTEM_ROLE_PERMISSIONS.SUPER_ADMIN];
    await admin.role.save();

    const left = await Agency.create({ code: "CYC_A", name: "Cycle A", type: "DEPARTMENT", status: "ACTIVE" });
    const right = await Agency.create({ code: "CYC_B", name: "Cycle B", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: left._id });
    left.parentAgencyId = right._id;
    await left.save();
    const cyclic = await userFor("GOV_ADMIN", "cycle-scope@example.com", left._id);
    const cyclicProject = await projectFor({ code: "INF-ROAD-6", agencyId: left._id, createdBy: cyclic.user._id });
    expect(
      (await request(harness).get(`/harness/projects/${cyclicProject._id.toString()}`).set("Authorization", `Bearer ${cyclic.token}`)).status,
    ).toBe(404);

    const dangling = await Agency.create({
      code: "DANGLE",
      name: "Dangling",
      type: "DEPARTMENT",
      status: "ACTIVE",
      parentAgencyId: new mongoose.Types.ObjectId(),
    });
    const lost = await userFor("GOV_ADMIN", "lost-scope@example.com", dangling._id);
    const lostProject = await projectFor({ code: "INF-ROAD-7", agencyId: dangling._id, createdBy: lost.user._id });
    expect(
      (await request(harness).get(`/harness/projects/${lostProject._id.toString()}`).set("Authorization", `Bearer ${lost.token}`)).status,
    ).toBe(404);

    vi.spyOn(Project, "findOne").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const down = await request(harness)
      .get(`/harness/projects/${project._id.toString()}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(down.status).toBe(503);
    expect(JSON.stringify(down.body)).not.toContain("database unavailable");
  });
});
