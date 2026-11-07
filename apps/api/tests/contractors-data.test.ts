import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { backfillContractors } from "../src/modules/contractors/contractor.backfill.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../src/modules/contractors/models/contractor-assignment.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";
import { dates, id, money, point } from "./helpers/domain-fixtures.js";

let n = 0;
const project = (patch: Record<string, unknown> = {}) => { n += 1; return Project.create({ projectCode: `INF-ROAD-${1000 + n}`, title: `P${n}`, projectType: "ROAD", agencyId: id(), createdBy: id(), budget: money, startDate: dates.start, plannedEndDate: dates.end, geometry: point, ...patch }); };
const assignment = (patch: Record<string, unknown>) => ContractorAssignment.create({ projectId: id(), contractorId: id(), agencyId: id(), role: "PRIMARY", startDate: dates.start, assignedBy: id(), ...patch });

describe("contractor data layer", () => {
  beforeAll(async () => { await startIsolatedMongo(); await Promise.all([Contractor.syncIndexes(), ContractorAssignment.syncIndexes()]); }, 120_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  beforeEach(async () => { await Promise.all([Contractor.deleteMany({}), ContractorAssignment.deleteMany({}), Project.deleteMany({})]); });

  it("accepts the new statuses and rejects unknown enum values and districts", async () => {
    await expect(Contractor.create({ name: "A", registrationNumber: "R-1", status: "SUSPENDED", operatingDistricts: ["Galle"] })).resolves.toBeTruthy();
    await expect(Contractor.create({ name: "B", registrationNumber: "R-2", status: "BANNED" })).rejects.toThrow();
    await expect(Contractor.create({ name: "C", registrationNumber: "R-3", operatingDistricts: ["Atlantis"] })).rejects.toThrow();
  });

  it("enforces one ACTIVE PRIMARY per project and one ACTIVE pair, while allowing additional contractors and history", async () => {
    const projectId = id(), c1 = id(), c2 = id(), c3 = id();
    await assignment({ projectId, contractorId: c1 });
    await expect(assignment({ projectId, contractorId: c2 })).rejects.toMatchObject({ code: 11000 });
    await expect(assignment({ projectId, contractorId: c1, role: "ADDITIONAL" })).rejects.toMatchObject({ code: 11000 });
    await expect(assignment({ projectId, contractorId: c3, role: "ADDITIONAL" })).resolves.toBeTruthy();
    await expect(assignment({ projectId, contractorId: c2, status: "REPLACED", endReason: "Replaced for cause", endDate: dates.end })).resolves.toBeTruthy();
  });

  it("requires an end reason once an assignment leaves ACTIVE and keeps dates ordered", async () => {
    await expect(assignment({ status: "ENDED" })).rejects.toThrow(/endReason/);
    await expect(assignment({ status: "ENDED", endReason: "done", endDate: new Date("2000-01-01") })).rejects.toThrow(/endDate/);
  });

  it("backfill: dry-run writes nothing, commit sets keys, owner and assignments, and is idempotent", async () => {
    const agencyId = id();
    const contractor = await Contractor.create({ name: "Alpha (Pvt) Ltd", registrationNumber: "R-9", contact: { email: "A@B.COM" } });
    const active = await project({ agencyId, contractorId: contractor._id, status: "ACTIVE" });
    await project({ agencyId, contractorId: contractor._id, status: "COMPLETED", actualEndDate: dates.end });
    const dry = await backfillContractors(false);
    expect(dry).toMatchObject({ mode: "dry-run", assignmentsToCreate: 2, ownersToSet: 1, assignmentsCreated: 0 });
    expect(await ContractorAssignment.countDocuments()).toBe(0);
    expect((await Contractor.findById(contractor._id))!.registeredByAgencyId).toBeUndefined();

    const done = await backfillContractors(true);
    expect(done.assignmentsCreated).toBe(2);
    const refreshed = (await Contractor.findById(contractor._id))!;
    expect(refreshed.nameKey).toBe("alpha"); expect(refreshed.emailKey).toBe("a@b.com"); expect(String(refreshed.registeredByAgencyId)).toBe(String(agencyId));
    const rows = await ContractorAssignment.find({}).lean();
    expect(rows.filter((r) => r.status === "ACTIVE")).toHaveLength(1);
    expect(rows.find((r) => r.status === "ENDED")!.endReason).toMatch(/backfilled/);
    expect(rows.every((r) => r.contractReference === undefined && r.contractValue === undefined)).toBe(true);
    expect(String(rows.find((r) => r.status === "ACTIVE")!.projectId)).toBe(String(active._id));

    const again = await backfillContractors(true);
    expect(again).toMatchObject({ assignmentsToCreate: 0, assignmentsCreated: 0, contractorsUpdated: 0 });
    expect(mongoose.connection.readyState).toBe(1);
  });
});
