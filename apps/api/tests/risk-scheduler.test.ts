import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { Project } from "../src/modules/projects/models/project.model.js";
import { RiskRun } from "../src/modules/risk/models/risk-run.model.js";
import {
  flushEventQueue,
  getEventQueueSize,
  getRecentRuns,
  getRunById,
  queueProjectForRiskAssessment,
  runRiskBatch,
  startAdminBulkRun,
  SYSTEM_RISK_ACTOR,
} from "../src/modules/risk/risk-scheduler.js";
import {
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

describe("Risk Scheduler & Lease-based Recalculation (§4.7, Step 122)", () => {
  beforeAll(async () => {
    await startIsolatedMongo();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  beforeEach(async () => {
    await RiskRun.deleteMany({});
    await Project.deleteMany({});
  });

  it("queues and debounces event-driven recalculation", async () => {
    const agencyId = new mongoose.Types.ObjectId();
    const createdBy = new mongoose.Types.ObjectId();
    const project = await Project.create({
      projectCode: "INF-EVENT-001",
      title: "Event Project 1",
      projectType: "ROAD",
      status: "ACTIVE",
      agencyId,
      createdBy,
      budget: { amountMinor: 10_000_000_00, currency: "LKR" },
    });

    const projectId = project._id.toString();
    expect(getEventQueueSize()).toBe(0);

    queueProjectForRiskAssessment(projectId);
    queueProjectForRiskAssessment(projectId); // duplicate ignored by Set
    expect(getEventQueueSize()).toBe(1);

    // Invalid ObjectId ignored
    queueProjectForRiskAssessment("invalid-id");
    expect(getEventQueueSize()).toBe(1);

    // Flushing processes the queued project
    const count = await flushEventQueue();
    expect(count).toBe(1);
    expect(getEventQueueSize()).toBe(0);
  });

  it("executes a batch run with atomic lease and updates counters", async () => {
    const agencyId = new mongoose.Types.ObjectId();
    const createdBy = new mongoose.Types.ObjectId();

    // Create 2 test projects
    await Project.create([
      {
        projectCode: "INF-SCHED-001",
        title: "Scheduler Test 1",
        projectType: "ROAD",
        status: "ACTIVE",
        agencyId,
        createdBy,
        budget: { amountMinor: 10_000_000_00, currency: "LKR" },
      },
      {
        projectCode: "INF-SCHED-002",
        title: "Scheduler Test 2",
        projectType: "BRIDGE",
        status: "ACTIVE",
        agencyId,
        createdBy,
        budget: { amountMinor: 20_000_000_00, currency: "LKR" },
      },
    ]);

    const run = await runRiskBatch("SCHEDULED", "platform", SYSTEM_RISK_ACTOR, 10, 0);

    expect(run.status).toBe("SUCCEEDED");
    expect(run.counters.considered).toBe(2);
    expect(run.counters.assessed).toBe(2);
    expect(run.counters.failed).toBe(0);

    // Run again immediately - should be unchanged
    const run2 = await runRiskBatch("SCHEDULED", "platform", SYSTEM_RISK_ACTOR, 10, 0);
    expect(run2.status).toBe("SUCCEEDED");
    expect(run2.counters.considered).toBe(2);
    expect(run2.counters.unchanged).toBe(2);
    expect(run2.counters.assessed).toBe(0);
  });

  it("blocks concurrent bulk admin runs with 409 RUN_IN_PROGRESS", async () => {
    // Create an active RUNNING run with valid lease
    await RiskRun.create({
      runId: "RUN-ACTIVE-TEST",
      trigger: "BULK_ADMIN",
      scope: "platform",
      status: "RUNNING",
      lockedBy: "worker-1",
      leaseUntil: new Date(Date.now() + 60_000),
      startedAt: new Date(),
    });

    await expect(
      startAdminBulkRun(SYSTEM_RISK_ACTOR, "platform"),
    ).rejects.toThrowError(/already in progress/);
  });

  it("retrieves recent runs and run details by id or runId", async () => {
    const created = await RiskRun.create({
      runId: "RUN-READ-TEST",
      trigger: "SCHEDULED",
      scope: "platform",
      status: "SUCCEEDED",
      startedAt: new Date(),
      finishedAt: new Date(),
      counters: { considered: 5, assessed: 5, unchanged: 0, notApplicable: 0, failed: 0 },
    });

    const recent = await getRecentRuns(10);
    expect(recent.length).toBe(1);
    expect(recent[0].runId).toBe("RUN-READ-TEST");

    const byRunId = await getRunById("RUN-READ-TEST");
    expect(byRunId).not.toBeNull();
    expect(byRunId?.status).toBe("SUCCEEDED");

    const byObjId = await getRunById(created._id.toString());
    expect(byObjId).not.toBeNull();
    expect(byObjId?.runId).toBe("RUN-READ-TEST");
  });
});
