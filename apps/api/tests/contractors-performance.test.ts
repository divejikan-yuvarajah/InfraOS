import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { clearPerformanceCache, performanceCacheSize } from "../src/modules/contractors/contractor-performance.service.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../src/modules/contractors/models/contractor-assignment.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { Milestone } from "../src/modules/projects/models/milestone.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { id } from "./helpers/domain-fixtures.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const get = (token: string, p: string) => request(app).get(`/api/v1/contractors${p}`).set("Authorization", `Bearer ${token}`);
let seq = 0;
const newContractor = (agencyId: unknown, patch: Record<string, unknown> = {}) => { seq += 1; return Contractor.create({ name: `Perf ${seq}`, registrationNumber: `P-${seq}`, registeredByAgencyId: agencyId, category: "GENERAL", ...patch }); };
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10); // keeps "recent" evidence recent whenever the suite runs

/** A COMPLETED project with an ENDED assignment, on time or late. */
async function finished(w: World, contractorId: unknown, agencyId: unknown, onTime: boolean, endDate = "2025-07-15") {
  const p = await makeProject(agencyId, { status: "COMPLETED", startDate: d("2025-01-01"), plannedEndDate: d("2025-06-01"), actualEndDate: d(onTime ? "2025-05-20" : "2025-07-10") });
  await ContractorAssignment.create({ projectId: p._id, contractorId, agencyId, role: "PRIMARY", status: "ENDED", startDate: d("2025-01-01"), endDate: d(endDate), endReason: "Work completed", assignedBy: w.gov.user._id });
  return p;
}

describe("contractor performance and risk (Step 94)", { timeout: 120_000 }, () => {
  let w: World;
  beforeAll(async () => { useTokenSecrets(); await startIsolatedMongo(); await Contractor.syncIndexes(); await ContractorAssignment.syncIndexes(); }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => { clearPerformanceCache(); await clearCoreCollections(); await AuditLog.collection.deleteMany({}); await Promise.all([Project.deleteMany({}), Contractor.deleteMany({}), ContractorAssignment.deleteMany({}), Milestone.deleteMany({}), Inspection.deleteMany({})]); });

  it("a contractor with no evidence gets INSUFFICIENT_EVIDENCE everywhere: no score, no band, no zeros", async () => {
    w = await contractorWorld();
    const c = await newContractor(w.ministry._id, { rating: 4.9, riskLevel: "LOW", activeProjects: 9, completedProjects: 99 });
    const res = await get(w.gov.token, `/${c._id}/performance`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.evidenceLevel).toBe("NONE");
    expect(data.band).toBe("NOT_ENOUGH_EVIDENCE");
    expect(data.indicators).toHaveLength(9);
    for (const i of data.indicators) { expect(i.status).toBe("INSUFFICIENT_EVIDENCE"); expect(i.value).toBeNull(); }
    expect(data.deferred).toEqual([]); // rework and quality findings are real indicators since rule set c2
    expect(JSON.stringify(res.body)).not.toMatch(/4\.9|"rating"|riskLevel|completedProjects/); // legacy caches are never trusted or shown
    expect(data.ruleVersion).toBe("c2");
  });

  it("computes indicators from in-scope evidence, with sample sizes, band and explained flags", async () => {
    w = await contractorWorld();
    const c = await newContractor(w.ministry._id);
    for (const onTime of [true, true, false]) await finished(w, c._id, w.child._id, onTime);
    const res = await get(w.gov.token, `/${c._id}/performance`);
    const by = Object.fromEntries(res.body.data.indicators.map((i: { key: string }) => [i.key, i]));
    expect(by.completionReliability).toMatchObject({ status: "OK", value: 100, sampleSize: 3 });
    expect(by.scheduleAdherence).toMatchObject({ status: "OK", value: 66.7, sampleSize: 3 });
    expect(by.scheduleAdherence.inputs.averageLateDays).toBe(39);
    expect(by.milestoneTimeliness.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(res.body.data.evidenceLevel).toBe("LOW");
    expect(res.body.data.band).toBe("NOT_ENOUGH_EVIDENCE"); // only 2 indicators have enough evidence
    expect(res.body.data.sample).toMatchObject({ projects: 3, assignments: 3 });
    expect(res.body.data.series.delay).toHaveLength(3);
    expect(by.scheduleAdherence.evidence[0].label).toMatch(/INF-ROAD-/);
  });

  it("milestones and inspections inside the assignment window feed their indicators and flags", async () => {
    w = await contractorWorld();
    const c = await newContractor(w.ministry._id);
    const projects = [] as Awaited<ReturnType<typeof finished>>[];
    for (const onTime of [true, true]) projects.push(await finished(w, c._id, w.child._id, onTime));
    projects.push(await finished(w, c._id, w.child._id, true, ago(30))); // assignment window reaches the recent inspections below
    for (let i = 0; i < 5; i += 1) await Milestone.create({ projectId: projects[0]!._id, title: `M${i}`, plannedStart: d("2025-01-02"), plannedEnd: d("2025-03-01"), actualEnd: d(i === 0 ? "2025-03-20" : "2025-02-20"), status: "COMPLETED", progress: 100 });
    await Milestone.create({ projectId: projects[0]!._id, title: "Outside the window", plannedStart: d("2020-01-02"), plannedEnd: d("2020-03-01"), actualEnd: d("2020-02-20"), status: "COMPLETED", progress: 100 });
    for (const status of ["VERIFIED", "REJECTED", "REJECTED"]) await Inspection.create({ projectId: projects[2]!._id, inspectorId: id(), inspectionDate: d(ago(60)), status });
    const res = await get(w.gov.token, `/${c._id}/performance`);
    const by = Object.fromEntries(res.body.data.indicators.map((i: { key: string }) => [i.key, i]));
    expect(by.milestoneTimeliness).toMatchObject({ status: "OK", value: 80, sampleSize: 5 });
    expect(by.inspectionOutcomeRate).toMatchObject({ status: "OK", value: 33.3 });
    expect(by.inspectionOutcomeRate.inputs.coarse).toBe(true);
    expect(res.body.data.band).toBe("WEAK"); // inspection outcomes under 60%
    expect(res.body.data.flags.map((f: { code: string }) => f.code)).toContain("FAILED_INSPECTIONS");
    for (const f of res.body.data.flags) { expect(f.reason.length).toBeGreaterThan(10); expect(f.evidence.length).toBeGreaterThan(0); }
  });

  it("evidence is limited to projects the viewer can read, and the cache never crosses scopes", async () => {
    w = await contractorWorld();
    const c = await newContractor(w.ministry._id);
    await finished(w, c._id, w.child._id, true);
    await finished(w, c._id, w.other._id, false); // another ministry's project
    await finished(w, c._id, w.other._id, false);
    const gov = await get(w.gov.token, `/${c._id}/performance`); // fills the cache for the ministry scope
    expect(gov.body.data.sample.projects).toBe(1);
    const platform = await get(w.superUser.token, `/${c._id}/performance`);
    expect(platform.body.data.sample.projects).toBe(3);
    const again = await get(w.gov.token, `/${c._id}/performance`);
    expect(again.body.data.sample.projects).toBe(1);
    expect(performanceCacheSize()).toBe(2);
    expect(JSON.stringify(gov.body)).not.toContain(String(w.other._id));
  });

  it("requires the performance permission; scope-less and unrelated viewers get 403 or 404", async () => {
    w = await contractorWorld();
    const c = await newContractor(w.ministry._id);
    expect((await request(app).get(`/api/v1/contractors/${c._id}/performance`)).status).toBe(401);
    expect((await get(w.officer.token, `/${c._id}/performance`)).status).toBe(403);
    expect((await get(w.manager.token, `/${c._id}/performance`)).status).toBe(403);
    expect((await get(w.contractorUser.token, `/${c._id}/performance`)).status).toBe(403);
    expect((await get(w.otherGov.token, `/${c._id}/performance`)).status).toBe(404);
    expect((await get(w.gov.token, `/${c._id}/performance?x=1`)).status).toBe(400);
  });

  it("flags suspended contractors with active work and expiring certifications", async () => {
    w = await contractorWorld();
    const c = await newContractor(w.ministry._id, { certifications: [{ name: "CIDA", expiresOn: new Date(Date.now() + 10 * 86_400_000) }, { name: "ISO", expiresOn: d("2020-01-01") }] });
    const p = await makeProject(w.child._id);
    await ContractorAssignment.create({ projectId: p._id, contractorId: c._id, agencyId: w.child._id, role: "PRIMARY", startDate: d("2026-01-01"), assignedBy: w.gov.user._id });
    await Contractor.updateOne({ _id: c._id }, { $set: { status: "SUSPENDED", statusReason: "Suspended after audit" } });
    const codes = (await get(w.gov.token, `/${c._id}/performance`)).body.data.flags.map((f: { code: string }) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["SUSPENDED_WITH_ACTIVE_WORK", "CERT_EXPIRED", "CERT_EXPIRING_30D", "INCOMPLETE_CONTRACT_DATA"]));
  });

  it("directory supports risk band filter and sort for permitted viewers, summary reports the distribution and truncation", async () => {
    w = await contractorWorld();
    const weak = await newContractor(w.ministry._id, { name: "Weak Co" });
    const none = await newContractor(w.ministry._id, { name: "None Co" });
    const p = await finished(w, weak._id, w.child._id, true, ago(30));
    for (const status of ["REJECTED", "REJECTED", "REJECTED"]) await Inspection.create({ projectId: p._id, inspectorId: id(), inspectionDate: d(ago(60)), status });
    const filtered = await get(w.gov.token, "/?riskBand=NOT_ENOUGH_EVIDENCE");
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.rows.map((r: { name: string }) => r.name).sort()).toEqual(["None Co", "Weak Co"]);
    expect(filtered.body.data.rows[0]).toHaveProperty("evidenceLevel");
    const sorted = await get(w.gov.token, "/?sort=risk");
    expect(sorted.body.data.rows[0].name).toBe("Weak Co");
    expect((await get(w.officer.token, "/?sort=risk")).status).toBe(403);
    const officerRows = (await get(w.superUser.token, "/")).body.data.rows;
    expect(officerRows.length).toBe(2);
    const sum = await get(w.gov.token, "/summary");
    expect(sum.body.data.performance).toMatchObject({ available: true, evaluated: 2, total: 2, truncated: false });
    expect(sum.body.data.performance.bands.NOT_ENOUGH_EVIDENCE).toBe(2);
    expect(sum.body.data.performance.attention[0]).toMatchObject({ name: "Weak Co" });
    const noPerm = await get(w.officer.token, "/summary");
    expect(noPerm.body.data.performance).toBeUndefined(); // hidden without the permission
    void none;
  });
});
