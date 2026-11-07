import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { backfillInspections } from "../src/modules/inspections/inspection.backfill.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { dates, id, money, point } from "./helpers/domain-fixtures.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

describe("inspection backfill (Batch 06)", { timeout: 120_000 }, () => {
  beforeAll(async () => { await startIsolatedMongo(); await Inspection.syncIndexes(); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => { await Promise.all([Inspection.deleteMany({}), Project.deleteMany({}), Counter.deleteMany({})]); });

  async function legacy() {
    const agencyId = id();
    const project = await Project.create({ projectCode: "INF-ROAD-7001", title: "Legacy", projectType: "ROAD", agencyId, createdBy: id(), budget: money, startDate: dates.start, plannedEndDate: dates.end, geometry: point, status: "ACTIVE" });
    // A legacy row: only the original fields, inserted natively so no new default is applied.
    await Inspection.collection.insertOne({ projectId: project._id, inspectorId: id(), inspectionDate: new Date("2026-03-01"), status: "VERIFIED", physicalProgress: 40, evidence: [], createdAt: new Date("2026-03-02"), updatedAt: new Date("2026-03-02") });
    return { project, agencyId };
  }

  it("dry run writes nothing; commit numbers rows, copies the agency and never invents progress; a second run changes nothing", async () => {
    const { agencyId } = await legacy();
    const dry = await backfillInspections(false);
    expect(dry).toMatchObject({ mode: "dry-run", scanned: 1, numbered: 1 });
    expect((await Inspection.collection.findOne({}))?.inspectionNo).toBeUndefined();

    const done = await backfillInspections(true);
    expect(done).toMatchObject({ mode: "commit", numbered: 1, agencySet: 1 });
    const row = (await Inspection.findOne({}).lean())!;
    expect(row.inspectionNo).toMatch(/^INS-2026-000001$/);
    expect(String(row.agencyId)).toBe(String(agencyId));
    expect(row.inspectionType).toBe("PROGRESS_VERIFICATION");
    expect(row.physicalProgress).toBe(40); // untouched, never recomputed
    expect(row.report).toBeUndefined();
    expect(row.submissions ?? []).toEqual([]);

    const again = await backfillInspections(true);
    expect(again).toMatchObject({ scanned: 0, numbered: 0, agencySet: 0 });
    expect((await Inspection.findOne({}).lean())!.inspectionNo).toBe(row.inspectionNo);
  });
});
