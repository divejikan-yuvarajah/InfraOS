import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { INDICATOR_MAPPING, orderCards } from "../src/modules/agencies/coordination-insights.js";
import { recomputeAssetHealth } from "../src/modules/assets/asset-health.recompute.js";
import { Asset } from "../src/modules/assets/models/asset.model.js";
import { AssetConditionAssessment } from "../src/modules/assets/models/asset-condition-assessment.model.js";
import { DASH } from "../src/modules/roadsync/dashboard.rules.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { id } from "./helpers/domain-fixtures.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const card = (agencyName: string, cases: number, healthScore: number | null) => ({ agencyId: agencyName, agencyName, cases, healthScore, grade: healthScore === null ? null : "good" });

describe("coordination insights facade (Step 107)", () => {
  it("orders alphabetically by default and never ranks agencies without enough cases", () => {
    const items = [card("Zeta", 20, 90), card("Alpha", 2, null), card("Mid", 9, 60), card("Beta", 0, null)];
    const byName = orderCards(items, "name");
    expect(byName.items.map((c) => c.agencyName)).toEqual(["Alpha", "Beta", "Mid", "Zeta"]);
    expect(byName.divider).toBeNull();
    const byHealth = orderCards(items, "health");
    expect(byHealth.items.map((c) => c.agencyName)).toEqual(["Zeta", "Mid", "Alpha", "Beta"]); // sufficient first, the rest alphabetical below the divider
    expect(byHealth.divider).toBe(2);
    expect(byHealth.items.filter((c) => c.availability === "NOT_ENOUGH_CASES").map((c) => c.agencyName)).toEqual(["Alpha", "Beta"]);
    expect(byHealth.items[0]!.casesNeeded).toBe(DASH.MIN_CASES_FOR_SCORE);
    // a score that RoadSync withheld stays withheld even when the caseload is high enough
    expect(orderCards([card("Odd", 99, null)], "health").items[0]!.availability).toBe("NOT_ENOUGH_CASES");
  });
  it("maps every scorecard field it shows, and lists the missing sources honestly", () => {
    const sources = INDICATOR_MAPPING.filter((m) => m.source !== null).map((m) => m.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(INDICATOR_MAPPING.filter((m) => m.source === null).map((m) => m.key)).toEqual(["repeatedSchedulingConflicts", "approvalTurnaround"]);
  });
});

describe("coordination insights endpoint and health recompute", { timeout: 120_000 }, () => {
  let w: World;
  beforeAll(async () => { useTokenSecrets(); await startIsolatedMongo(); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => { await clearCoreCollections(); await Promise.all([Asset.deleteMany({}), Project.deleteMany({}), AssetConditionAssessment.collection.deleteMany({})]); });
  const get = (token: string, q = "") => request(createApp()).get(`/api/v1/insights/coordination${q}`).set("Authorization", `Bearer ${token}`);

  it("is permission-gated exactly like the RoadSync dashboard, with the same agency rules and unknown queries rejected", async () => {
    w = await contractorWorld();
    expect((await request(createApp()).get("/api/v1/insights/coordination")).status).toBe(401);
    for (const who of [w.contractorUser, w.citizen]) expect((await get(who.token)).status).toBe(403);
    const national = await get(w.superUser.token);
    expect(national.status).toBe(200);
    expect(national.body.data).toMatchObject({ level: "national", sort: "name" });
    expect(national.body.data.meta).toMatchObject({ minCases: 5, minCohort: 3 });
    expect(national.body.data.benchmarkUnavailable).toBe("cohort_too_small");
    const own = await get(w.officer.token);
    expect(own.status).toBe(200);
    expect(own.body.data.level).toBe("agency");
    expect(own.body.data.own.availability).toBe("NOT_ENOUGH_CASES");
    expect((await get(w.officer.token, `?agencyId=${w.sibling._id}`)).status).toBe(403); // only national viewers may narrow
    expect((await get(w.superUser.token, "?bogus=1")).status).toBe(400);
    expect((await get(w.superUser.token, "?sort=health")).body.data.sort).toBe("health");
  });

  it("recompute is a dry run by default and only touches assets whose health really changed", async () => {
    w = await contractorWorld();
    const project = await makeProject(w.child._id, { status: "COMPLETED" });
    const mk = (name: string, over: Record<string, unknown> = {}) => Asset.create({ sourceProjectId: project._id, assetType: "ROAD", name, agencyId: w.child._id, condition: "GOOD", commissionedAt: new Date("2024-01-01"), operationalStatus: "IN_SERVICE", monitoringIntervalDays: 365, ...over });
    // a stale cache: the stored score says 80 but no assessment exists, so the rules give no score
    const stale = await mk("Stale cache (Synthetic)", { healthScore: 80 });
    // a fresh assessment that matches its cache
    const fresh = await mk("Fresh (Synthetic)");
    await AssetConditionAssessment.create({ assetId: fresh._id, agencyId: w.child._id, assessedAt: new Date(Date.now() - 86_400_000), condition: "GOOD", basis: "MANUAL_ENTRY", issues: [], assessedBy: id(), status: "ACTIVE" });
    const dry = await recomputeAssetHealth(false);
    expect(dry).toMatchObject({ mode: "dry-run", scanned: 2, becomingUnavailable: 1, becomingAvailable: 1 });
    expect((await Asset.findById(stale._id))!.healthScore).toBe(80); // nothing written in a dry run
    const done = await recomputeAssetHealth(true);
    expect(done).toMatchObject({ mode: "commit", changed: 2 });
    expect((await Asset.findById(stale._id))!.healthScore).toBeUndefined(); // unset, never 0
    expect((await Asset.findById(fresh._id))!.healthScore).toBeGreaterThan(0);
    expect(await recomputeAssetHealth(true)).toMatchObject({ changed: 0, unchanged: 2 });
  });
});
