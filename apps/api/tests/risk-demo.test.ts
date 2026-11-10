import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Project } from "../src/modules/projects/models/project.model.js";
import { DEMO_RISK_PROJECT_CODES } from "../src/database/seeds/demo/catalog.js";
import { seedDemoRiskProjects } from "../src/database/seeds/demo/seed-risk-demo.js";
import { assessProject } from "../src/modules/risk/risk-assessment.service.js";
import { SYSTEM_RISK_ACTOR } from "../src/modules/risk/risk-scheduler.js";
import {
  startIsolatedMongo,
  stopIsolatedMongo,
} from "./helpers/mongo-memory.js";

describe("Risk Intelligence Synthetic Demo Projects & Determinism (§4.10, Step 122)", () => {
  beforeAll(async () => {
    await startIsolatedMongo();
  });

  afterAll(async () => {
    await stopIsolatedMongo();
  });

  it("seeds all 8 demo projects idempotently", async () => {
    const result1 = await seedDemoRiskProjects();
    expect(result1.count).toBe(8);

    const count = await Project.countDocuments({
      projectCode: { $in: [...DEMO_RISK_PROJECT_CODES] },
    });
    expect(count).toBe(8);

    // Re-seeding produces identical 8 projects without duplicate key errors
    const result2 = await seedDemoRiskProjects();
    expect(result2.count).toBe(8);
  });

  it("evaluates expected risk levels on seeded demo projects deterministically", async () => {
    const now = new Date();

    // 1. Healthy project -> LOW
    const healthy = await Project.findOne({ projectCode: "INF-RISK_HEALTHY-001" });
    expect(healthy).not.toBeNull();
    const resHealthy = await assessProject(
      SYSTEM_RISK_ACTOR,
      healthy!._id.toString(),
      "ON_DEMAND",
      now,
    );
    expect(resHealthy.assessment.overallLevel).toBe("LOW");

    // 2. Delayed project -> HIGH
    const delayed = await Project.findOne({ projectCode: "INF-RISK_DELAYED-001" });
    expect(delayed).not.toBeNull();
    const resDelayed = await assessProject(
      SYSTEM_RISK_ACTOR,
      delayed!._id.toString(),
      "ON_DEMAND",
      now,
    );
    expect(["HIGH", "CRITICAL"]).toContain(resDelayed.assessment.overallLevel);

    // 3. Financial ahead of physical -> HIGH or CRITICAL
    const finAhead = await Project.findOne({ projectCode: "INF-RISK_FINAHEAD-001" });
    expect(finAhead).not.toBeNull();
    const resFinAhead = await assessProject(
      SYSTEM_RISK_ACTOR,
      finAhead!._id.toString(),
      "ON_DEMAND",
      now,
    );
    expect(["HIGH", "CRITICAL"]).toContain(resFinAhead.assessment.overallLevel);

    // 4. RoadSync conflict project -> HIGH or CRITICAL
    const conflict = await Project.findOne({ projectCode: "INF-RISK_CONFLICT-001" });
    expect(conflict).not.toBeNull();
    const resConflict = await assessProject(
      SYSTEM_RISK_ACTOR,
      conflict!._id.toString(),
      "ON_DEMAND",
      now,
    );
    expect(["HIGH", "CRITICAL"]).toContain(resConflict.assessment.overallLevel);

    // 7. No data project -> NOT_ASSESSABLE
    const noData = await Project.findOne({ projectCode: "INF-RISK_NODATA-001" });
    expect(noData).not.toBeNull();
    const resNoData = await assessProject(
      SYSTEM_RISK_ACTOR,
      noData!._id.toString(),
      "ON_DEMAND",
      now,
    );
    expect(resNoData.assessment.overallLevel).toBe("NOT_ASSESSABLE");

    // 8. Completed project -> applicable: false
    const complete = await Project.findOne({ projectCode: "INF-RISK_COMPLETE-001" });
    expect(complete).not.toBeNull();
    const resComplete = await assessProject(
      SYSTEM_RISK_ACTOR,
      complete!._id.toString(),
      "ON_DEMAND",
      now,
    );
    expect(resComplete.assessment.applicable).toBe(false);

    // Assert determinism on replay
    const replayDelayed = await assessProject(
      SYSTEM_RISK_ACTOR,
      delayed!._id.toString(),
      "ON_DEMAND",
      now,
      { force: true },
    );
    expect(replayDelayed.assessment.inputsHash).toBe(resDelayed.assessment.inputsHash);
  });
});
