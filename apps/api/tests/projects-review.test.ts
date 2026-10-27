import { hash } from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { Agency } from "../src/modules/agencies/models/agency.model.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { signAccessToken } from "../src/modules/identity/auth/jwt.js";
import { Role } from "../src/modules/identity/models/role.model.js";
import { User } from "../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../src/modules/identity/seed/system-role-permissions.js";
import { PROJECT_STATUSES } from "../src/modules/projects/project.constants.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { projectHooks } from "../src/modules/projects/projects.service.js";
import { reviewTarget } from "../src/modules/projects/review.policy.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import type { SystemRoleKey } from "@infraos/shared-types";

const app = createApp();

describe("review policy", () => {
  it("follows the approved review edges and requires a reason only for reject and return", () => {
    expect(PROJECT_STATUSES).toContain("REJECTED");
    expect(reviewTarget("SUBMITTED", "BEGIN_REVIEW")).toBe("UNDER_REVIEW");
    expect(reviewTarget("SUBMITTED", "REJECT")).toBe("REJECTED");
    expect(reviewTarget("UNDER_REVIEW", "APPROVE")).toBe("APPROVED");
    expect(reviewTarget("UNDER_REVIEW", "REJECT")).toBe("REJECTED");
    expect(reviewTarget("UNDER_REVIEW", "RETURN_FOR_CHANGES")).toBe("DRAFT");
    expect(reviewTarget("SUBMITTED", "APPROVE")).toBeNull();
    expect(reviewTarget("SUBMITTED", "RETURN_FOR_CHANGES")).toBeNull();
    expect(reviewTarget("REJECTED", "APPROVE")).toBeNull();
    expect(reviewTarget("DRAFT", "BEGIN_REVIEW")).toBeNull();
    expect(reviewTarget("APPROVED", "APPROVE")).toBeNull();
  });
});

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

const draftBody = {
  projectCode: "INF-REV-57",
  title: "Review Road",
  description: "Synthetic review proposal",
  projectType: "ROAD",
  budget: { amountMinor: 2500000000, currency: "LKR" },
};

describe("step 57 project review", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    env.ACCESS_TOKEN_SECRET = "access-secret-step57-0123456789abcdef";
    env.REFRESH_TOKEN_SECRET = "refresh-secret-step57-0123456789abcdef";
    await startIsolatedMongo();
  }, 300_000);

  afterEach(async () => {
    projectHooks.beforeAudit = async () => {};
    await Project.deleteMany({});
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  async function world() {
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
    return {
      ministry,
      child,
      other,
      gov: await actor("gov57@example.com", "GOV_ADMIN", ministry._id),
      reviewer: await actor("reviewer57@example.com", "GOV_ADMIN", ministry._id),
      foreign: await actor("foreign57@example.com", "GOV_ADMIN", other._id),
      officer: await actor("officer57@example.com", "AGENCY_OFFICER", child._id),
      manager: await actor("pm57@example.com", "PROJECT_MANAGER", child._id),
      superUser: await actor("super57@example.com", "SUPER_ADMIN", ministry._id),
      contractor: await actor("contractor57@example.com", "CONTRACTOR", child._id),
      inspector: await actor("inspector57@example.com", "INSPECTOR", child._id),
      citizen: await actor("citizen57@example.com", "CITIZEN", child._id),
    };
  }

  async function submittedProject(token: string, code = "INF-REV-57") {
    const created = await request(app).post("/api/v1/projects").set("Authorization", `Bearer ${token}`).send({ ...draftBody, projectCode: code, title: code });
    expect(created.status).toBe(201);
    const id = created.body.data.project.id as string;
    const filled = await request(app).patch(`/api/v1/projects/${id}`).set("Authorization", `Bearer ${token}`).send({
      startDate: "2027-01-01T00:00:00.000Z",
      plannedEndDate: "2027-06-01T00:00:00.000Z",
      location: { district: "Colombo", province: "Western" },
      geometry: { type: "Point", coordinates: [79.86, 6.93] },
      revision: created.body.data.project.revision,
    });
    expect(filled.status).toBe(200);
    const submitted = await request(app).post(`/api/v1/projects/${id}/transition`).set("Authorization", `Bearer ${token}`).send({
      action: "SUBMIT",
      revision: filled.body.data.project.revision,
    });
    expect(submitted.status).toBe(200);
    return submitted.body.data.project as { id: string; revision: number; status: string; title: string };
  }

  it("queues in-scope work and moves it from submitted to approved", async () => {
    const data = await world();
    const project = await submittedProject(data.officer.token);
    expect(project.status).toBe("SUBMITTED");

    expect((await request(app).get("/api/v1/projects/review-queue")).status).toBe(401);
    expect((await request(app).get("/api/v1/projects/review-queue").set("Authorization", `Bearer ${data.officer.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects/review-queue").set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects/review-queue").set("Authorization", `Bearer ${data.contractor.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects/review-queue").set("Authorization", `Bearer ${data.inspector.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects/review-queue").set("Authorization", `Bearer ${data.citizen.token}`)).status).toBe(403);
    expect((await request(app).get("/api/v1/projects/review-queue").set("Authorization", `Bearer ${data.superUser.token}`)).status).toBe(403);

    const foreignQueue = await request(app).get("/api/v1/projects/review-queue").set("Authorization", `Bearer ${data.foreign.token}`);
    expect(foreignQueue.status).toBe(200);
    expect(foreignQueue.body.data.total).toBe(0);
    expect(foreignQueue.body.data.counts).toEqual({ submitted: 0, underReview: 0 });

    const queue = await request(app).get("/api/v1/projects/review-queue?sortBy=title&sortDir=asc").set("Authorization", `Bearer ${data.gov.token}`);
    expect(queue.status).toBe(200);
    expect(queue.headers["cache-control"]).toContain("no-store");
    expect(queue.body.data.total).toBe(1);
    expect(queue.body.data.counts.submitted).toBe(1);
    expect(queue.body.data.projects[0].projectCode).toBe("INF-REV-57");
    expect(JSON.stringify(queue.body)).not.toContain("passwordHash");

    const missed = await request(app).get("/api/v1/projects/review-queue?q=missing-code").set("Authorization", `Bearer ${data.gov.token}`);
    expect(missed.body.data.total).toBe(0);
    expect(missed.body.data.counts.submitted).toBe(1);
    expect((await request(app).get("/api/v1/projects/review-queue?status=DRAFT").set("Authorization", `Bearer ${data.gov.token}`)).status).toBe(400);

    const hidden = await request(app).get(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.foreign.token}`);
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toContain("INF-REV-57");
    expect((await request(app).get(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.manager.token}`)).status).toBe(403);

    const detail = await request(app).get(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.submission.found).toBe(true);
    expect(detail.body.data.submission.userId).toBe(data.officer.user._id.toString());
    expect(detail.body.data.project.availableReviewActions).toEqual(["BEGIN_REVIEW", "REJECT"]);
    expect(detail.body.data.decisions).toEqual([]);

    const rejected = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "REJECT",
      revision: project.revision,
    });
    expect(rejected.status).toBe(400);
    expect((await Project.findById(project.id))?.status).toBe("SUBMITTED");
    const extra = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: project.revision,
      reason: "stored nowhere",
    });
    expect(extra.status).toBe(400);
    const plain = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).set("Content-Type", "text/plain").send("nope");
    expect(plain.status).toBe(415);

    const direct = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "APPROVE",
      revision: project.revision,
    });
    expect(direct.status).toBe(409);
    expect((await Project.findById(project.id))?.status).toBe("SUBMITTED");

    const stale = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: project.revision + 4,
    });
    expect(stale.status).toBe(409);

    const begun = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: project.revision,
    });
    expect(begun.status).toBe(200);
    expect(begun.body.data.project.status).toBe("UNDER_REVIEW");
    expect(begun.body.data.project.availableReviewActions).toEqual(["APPROVE", "REJECT", "RETURN_FOR_CHANGES"]);
    const started = await AuditLog.findOne({ resourceId: project.id, action: "project.review_started" }).select("+oldValue +newValue userId");
    expect(started?.userId?.toString()).toBe(data.gov.user._id.toString());
    expect(started?.newValue).toMatchObject({ status: "UNDER_REVIEW" });
    expect(started?.newValue?.reason ?? null).toBeNull();

    const govRole = await Role.findOne({ key: "GOV_ADMIN" });
    await User.updateOne({ _id: data.officer.user._id }, { roleId: govRole?._id });
    const self = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.officer.token}`).send({
      action: "APPROVE",
      revision: begun.body.data.project.revision,
    });
    expect(self.status).toBe(409);
    expect((await Project.findById(project.id))?.status).toBe("UNDER_REVIEW");

    const approved = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "APPROVE",
      revision: begun.body.data.project.revision,
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data.project.status).toBe("APPROVED");
    expect(approved.body.data.project.availableReviewActions).toEqual([]);
    const approval = await AuditLog.findOne({ resourceId: project.id, action: "project.approved" }).select("+newValue userId");
    expect(approval?.userId?.toString()).toBe(data.reviewer.user._id.toString());

    const startedLater = await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "START",
      revision: approved.body.data.project.revision,
    });
    expect(startedLater.status).toBe(403);
    expect((await Project.findById(project.id))?.status).toBe("APPROVED");
    const completed = await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "COMPLETE",
      revision: approved.body.data.project.revision,
    });
    expect(completed.status).toBe(409);
    expect((await Project.findById(project.id))?.status).toBe("APPROVED");
  });

  it("fails closed without a trusted submission, on a duplicate event, and when the audit write fails", async () => {
    const data = await world();
    const project = await submittedProject(data.officer.token, "INF-REV-58");
    await AuditLog.collection.deleteMany({ resourceId: new mongoose.Types.ObjectId(project.id) });
    const missing = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: project.revision,
    });
    expect(missing.status).toBe(409);
    expect((await Project.findById(project.id))?.status).toBe("SUBMITTED");

    const second = await submittedProject(data.officer.token, "INF-REV-59");
    await AuditLog.create({
      userId: data.manager.user._id,
      action: "project.submitted",
      resourceType: "PROJECT",
      resourceId: second.id,
      oldValue: { status: "DRAFT", agencyId: data.child._id },
      newValue: { status: "SUBMITTED", agencyId: data.child._id },
      requestId: "duplicate-submit",
      agencyId: data.child._id,
    });
    const ambiguous = await request(app).post(`/api/v1/projects/${second.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: second.revision,
    });
    expect(ambiguous.status).toBe(409);
    expect((await Project.findById(second.id))?.status).toBe("SUBMITTED");

    const third = await submittedProject(data.officer.token, "INF-REV-60");
    projectHooks.beforeAudit = async () => {
      throw new Error("audit down");
    };
    const rolled = await request(app).post(`/api/v1/projects/${third.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: third.revision,
    });
    expect(rolled.status).toBe(503);
    expect((await Project.findById(third.id))?.status).toBe("SUBMITTED");
  });

  it("rejects a revoked approval grant and a second decision on the same revision", async () => {
    const data = await world();
    const project = await submittedProject(data.officer.token, "INF-REV-61");
    await Role.updateOne({ key: "GOV_ADMIN" }, { $pull: { permissions: "project.approve" } });
    const revoked = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: project.revision,
    });
    expect(revoked.status).toBe(403);
    expect((await Project.findById(project.id))?.status).toBe("SUBMITTED");
    await Role.updateOne({ key: "GOV_ADMIN" }, { $addToSet: { permissions: "project.approve" } });

    const first = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: project.revision,
    });
    expect(first.status).toBe(200);
    const second = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "BEGIN_REVIEW",
      revision: project.revision,
    });
    expect(second.status).toBe(409);
    expect((await Project.findById(project.id))?.status).toBe("UNDER_REVIEW");
    const events = await AuditLog.find({ resourceId: project.id, action: "project.review_started" });
    expect(events).toHaveLength(1);
  });

  it("stores a rejection reason, returns a project to draft, and keeps the next submission unambiguous", async () => {
    const data = await world();
    const rejected = await submittedProject(data.officer.token, "INF-REV-62");
    const missing = await request(app).post(`/api/v1/projects/${rejected.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "REJECT",
      revision: rejected.revision,
    });
    expect(missing.status).toBe(400);
    expect((await Project.findById(rejected.id))?.status).toBe("SUBMITTED");
    const unsafe = await request(app).post(`/api/v1/projects/${rejected.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "REJECT",
      revision: rejected.revision,
      reason: "cost $where",
    });
    expect(unsafe.status).toBe(400);

    const govRole = await Role.findOne({ key: "GOV_ADMIN" });
    await User.updateOne({ _id: data.officer.user._id }, { roleId: govRole?._id });
    const own = await request(app).post(`/api/v1/projects/${rejected.id}/review`).set("Authorization", `Bearer ${data.officer.token}`).send({
      action: "REJECT",
      revision: rejected.revision,
      reason: "The submitter cannot decide this case.",
    });
    expect(own.status).toBe(409);
    expect((await Project.findById(rejected.id))?.status).toBe("SUBMITTED");
    const officerRole = await Role.findOne({ key: "AGENCY_OFFICER" });
    await User.updateOne({ _id: data.officer.user._id }, { roleId: officerRole?._id });

    const decision = await request(app).post(`/api/v1/projects/${rejected.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "REJECT",
      revision: rejected.revision,
      reason: "The alignment crosses a protected drain.",
    });
    expect(decision.status).toBe(200);
    expect(decision.body.data.project.status).toBe("REJECTED");
    const stored = await AuditLog.findOne({ resourceId: rejected.id, action: "project.rejected" }).select("+newValue userId requestId");
    expect(stored?.newValue).toMatchObject({ status: "REJECTED", reason: "The alignment crosses a protected drain." });
    expect(stored?.userId?.toString()).toBe(data.reviewer.user._id.toString());
    const ownerView = await request(app).get(`/api/v1/projects/${rejected.id}`).set("Authorization", `Bearer ${data.officer.token}`);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.data.project.reviewDecision.reason).toBe("The alignment crosses a protected drain.");
    expect(ownerView.body.data.project.canEditDraft).toBe(false);
    const history = await request(app).get(`/api/v1/projects/${rejected.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`);
    expect(history.status).toBe(200);
    expect(history.body.data.decisions).toEqual([
      expect.objectContaining({
        action: "project.rejected",
        status: "REJECTED",
        reason: "The alignment crosses a protected drain.",
        userId: data.reviewer.user._id.toString(),
      }),
    ]);
    const hidden = await request(app).get(`/api/v1/projects/${rejected.id}/review`).set("Authorization", `Bearer ${data.foreign.token}`);
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toContain("protected drain");

    const returned = await submittedProject(data.officer.token, "INF-REV-63");
    const begun = await request(app).post(`/api/v1/projects/${returned.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: returned.revision,
    });
    const back = await request(app).post(`/api/v1/projects/${returned.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "RETURN_FOR_CHANGES",
      revision: begun.body.data.project.revision,
      reason: "Add the missing locality description.",
    });
    expect(back.status).toBe(200);
    expect(back.body.data.project.status).toBe("DRAFT");
    expect(back.body.data.project.canEditDraft).toBe(true);
    const officerDraft = await request(app).get(`/api/v1/projects/${returned.id}`).set("Authorization", `Bearer ${data.officer.token}`);
    expect(officerDraft.body.data.project.status).toBe("DRAFT");
    expect(officerDraft.body.data.project.canEditDraft).toBe(true);
    expect(officerDraft.body.data.project.reviewDecision.reason).toBe("Add the missing locality description.");
    const returnHistory = await request(app).get(`/api/v1/projects/${returned.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`);
    expect(returnHistory.body.data.decisions.map((item: { action: string }) => item.action)).toEqual(["project.returned", "project.review_started"]);
    const resubmitted = await request(app).post(`/api/v1/projects/${returned.id}/transition`).set("Authorization", `Bearer ${data.officer.token}`).send({
      action: "SUBMIT",
      revision: officerDraft.body.data.project.revision,
    });
    expect(resubmitted.status).toBe(200);
    const again = await request(app).post(`/api/v1/projects/${returned.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: resubmitted.body.data.project.revision,
    });
    expect(again.status).toBe(200);
    expect(again.body.data.project.status).toBe("UNDER_REVIEW");
  });

  it("reopens a rejected project for an in-scope editor and keeps the rejection", async () => {
    const data = await world();
    const project = await submittedProject(data.officer.token, "INF-REV-64");
    const rejected = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`).send({
      action: "REJECT",
      revision: project.revision,
      reason: "The drain crossing is not shown.",
    });
    expect(rejected.status).toBe(200);
    const illegal = await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.officer.token}`).send({
      action: "REOPEN",
      revision: project.revision,
    });
    expect(illegal.status).toBe(409);
    expect((await Project.findById(project.id))?.status).toBe("REJECTED");
    const outsider = await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.foreign.token}`).send({
      action: "REOPEN",
      revision: rejected.body.data.project.revision,
    });
    expect(outsider.status).toBe(404);
    expect((await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.citizen.token}`).send({
      action: "REOPEN",
      revision: rejected.body.data.project.revision,
    })).status).toBe(403);
    expect((await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.manager.token}`).send({
      action: "REOPEN",
      revision: rejected.body.data.project.revision,
    })).status).toBe(404);

    const reopened = await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.officer.token}`).send({
      action: "REOPEN",
      revision: rejected.body.data.project.revision,
    });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.project.status).toBe("DRAFT");
    expect(reopened.body.data.project.canEditDraft).toBe(true);
    expect(reopened.body.data.project.reviewDecision.reason).toBe("The drain crossing is not shown.");
    const rejection = await AuditLog.findOne({ resourceId: project.id, action: "project.rejected" }).select("+newValue");
    expect(rejection?.newValue).toMatchObject({ status: "REJECTED", reason: "The drain crossing is not shown." });
    const cycle = await AuditLog.findOne({ resourceId: project.id, action: "project.reopened" }).select("+oldValue +newValue");
    expect(cycle?.oldValue).toMatchObject({ status: "REJECTED" });
    expect(cycle?.newValue).toMatchObject({ status: "DRAFT" });
    expect(cycle?.newValue && "reason" in cycle.newValue ? cycle.newValue.reason ?? null : null).toBeNull();

    const edited = await request(app).patch(`/api/v1/projects/${project.id}`).set("Authorization", `Bearer ${data.officer.token}`).send({
      title: "Review Road corrected",
      revision: reopened.body.data.project.revision,
    });
    expect(edited.status).toBe(200);
    const resubmitted = await request(app).post(`/api/v1/projects/${project.id}/transition`).set("Authorization", `Bearer ${data.officer.token}`).send({
      action: "SUBMIT",
      revision: edited.body.data.project.revision,
    });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data.project.status).toBe("SUBMITTED");
    const reviewed = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.gov.token}`).send({
      action: "BEGIN_REVIEW",
      revision: resubmitted.body.data.project.revision,
    });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.project.status).toBe("UNDER_REVIEW");
    const history = await request(app).get(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.reviewer.token}`);
    expect(history.body.data.decisions.map((item: { action: string }) => item.action)).toEqual([
      "project.review_started",
      "project.reopened",
      "project.rejected",
    ]);
    expect(history.body.data.decisions.find((item: { action: string }) => item.action === "project.rejected").reason).toBe("The drain crossing is not shown.");
    const govRole = await Role.findOne({ key: "GOV_ADMIN" });
    await User.updateOne({ _id: data.officer.user._id }, { roleId: govRole?._id });
    const own = await request(app).post(`/api/v1/projects/${project.id}/review`).set("Authorization", `Bearer ${data.officer.token}`).send({
      action: "APPROVE",
      revision: reviewed.body.data.project.revision,
    });
    expect(own.status).toBe(409);
    expect((await Project.findById(project.id))?.status).toBe("UNDER_REVIEW");
  });
});
