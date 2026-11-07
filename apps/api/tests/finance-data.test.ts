import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { backfillFinance } from "../src/modules/finance/finance.backfill.js";
import { ProjectBudgetRevision } from "../src/modules/finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../src/modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { dates, id, money, point } from "./helpers/domain-fixtures.js";
import { startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

let n = 0;
const project = (patch: Record<string, unknown> = {}) => { n += 1; return Project.create({ projectCode: `INF-ROAD-${7000 + n}`, title: `P${n}`, projectType: "ROAD", agencyId: id(), createdBy: id(), budget: money, startDate: dates.start, plannedEndDate: dates.end, geometry: point, status: "ACTIVE", ...patch }); };
const revision = (patch: Record<string, unknown>) => ProjectBudgetRevision.create({ projectId: id(), agencyId: id(), sequence: 1, kind: "INITIAL", status: "APPROVED", previousTotal: { amountMinor: 0, currency: "LKR" }, newTotal: { amountMinor: 1000, currency: "LKR" }, requestedAt: new Date(), ...patch });

describe("finance data layer", () => {
  beforeAll(async () => { await startIsolatedMongo(); await Promise.all([ProjectBudgetRevision.syncIndexes(), ProjectExpense.syncIndexes(), ProjectPayment.syncIndexes()]); }, 120_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  beforeEach(async () => { await ProjectBudgetRevision.collection.deleteMany({}); await Promise.all([ProjectExpense.deleteMany({}), ProjectPayment.deleteMany({}), Project.deleteMany({}), Counter.deleteMany({})]); });

  it("budget revisions validate totals, allocations and reasons, and stay append-only", async () => {
    await expect(revision({ newTotal: { amountMinor: 0, currency: "LKR" } })).rejects.toThrow(/positive/);
    await expect(revision({ allocations: [{ category: "MATERIALS", amount: { amountMinor: 600, currency: "LKR" } }, { category: "LABOUR", amount: { amountMinor: 600, currency: "LKR" } }] })).rejects.toThrow(/exceed/);
    await expect(revision({ allocations: [{ category: "MATERIALS", amount: { amountMinor: 1, currency: "LKR" } }, { category: "MATERIALS", amount: { amountMinor: 1, currency: "LKR" } }] })).rejects.toThrow(/duplicate/);
    await expect(revision({ kind: "REVISION", sequence: 2, status: "PENDING_APPROVAL", reason: "short" })).rejects.toThrow(/reason/);
    const ok = await revision({ kind: "REVISION", sequence: 2, status: "PENDING_APPROVAL", reason: "A properly explained revision" });
    await expect(ProjectBudgetRevision.deleteOne({ _id: ok._id })).rejects.toThrow(/append-only/);
    await expect(ProjectBudgetRevision.updateOne({ _id: ok._id }, { $set: { reason: "x" } })).rejects.toThrow(/append-only/); // filter does not name the pending state
    await expect(ProjectBudgetRevision.updateOne({ _id: ok._id, status: "APPROVED" }, { $set: { reason: "x" } })).rejects.toThrow(/append-only/);
    await expect(ProjectBudgetRevision.updateOne({ _id: ok._id, status: "PENDING_APPROVAL" }, { $set: { status: "CANCELLED" } })).resolves.toBeTruthy();
  });

  it("at most one pending revision per project and unique sequence", async () => {
    const projectId = id();
    await revision({ projectId, kind: "REVISION", sequence: 2, status: "PENDING_APPROVAL", reason: "First pending revision" });
    await expect(revision({ projectId, kind: "REVISION", sequence: 3, status: "PENDING_APPROVAL", reason: "Second pending revision" })).rejects.toMatchObject({ code: 11000 });
    await expect(revision({ projectId, kind: "REVISION", sequence: 2, status: "REJECTED", reason: "Same sequence again", decisionNote: "Rejected for a reason here" })).rejects.toMatchObject({ code: 11000 });
  });

  it("duplicate guards: one active expense per key and one active invoice per contractor and project", async () => {
    const base = { projectId: id(), agencyId: id(), category: "MATERIALS", description: "d", expenseDate: new Date(), amount: money, supportingRef: "R", createdBy: id() };
    await ProjectExpense.create({ ...base, expenseNo: "EXP-2026-000001", duplicateKey: "k1", status: "VERIFIED", dupActive: true });
    await expect(ProjectExpense.create({ ...base, expenseNo: "EXP-2026-000002", duplicateKey: "k1", status: "PENDING_VERIFICATION", dupActive: true })).rejects.toMatchObject({ code: 11000 });
    await expect(ProjectExpense.create({ ...base, expenseNo: "EXP-2026-000003", duplicateKey: "k1", status: "REVERSED", dupActive: false })).resolves.toBeTruthy();
    await expect(ProjectExpense.create({ ...base, expenseNo: "EXP-2026-000004", duplicateKey: "k1", status: "DRAFT" })).resolves.toBeTruthy();
    await expect(ProjectExpense.create({ ...base, expenseNo: "EXP-2026-000005", duplicateKey: "k2", amount: { amountMinor: -1, currency: "LKR" } })).rejects.toThrow();
    const pay = { projectId: id(), contractorId: id(), amount: money, paymentType: "INTERIM", date: new Date(), createdBy: id(), invoiceReference: "INV-1" };
    await ProjectPayment.create({ ...pay, paymentNo: "PAY-2026-000001", dupActive: true });
    await expect(ProjectPayment.create({ ...pay, paymentNo: "PAY-2026-000002", dupActive: true })).rejects.toMatchObject({ code: 11000 });
    await expect(ProjectPayment.create({ ...pay, paymentNo: "PAY-2026-000003", status: "REJECTED", dupActive: false })).resolves.toBeTruthy();
    await expect(ProjectPayment.create({ ...pay, paymentNo: "PAY-2026-000001", invoiceReference: "INV-2", dupActive: true })).rejects.toMatchObject({ code: 11000 }); // paymentNo unique
    await expect(ProjectPayment.create({ ...pay, status: "REVERSED", invoiceReference: "INV-9", approvedBy: pay.createdBy })).rejects.toThrow(/cannot approve/);
  });

  it("legacy payment rows stay valid (new fields optional) and the paid-reference rule applies to numbered rows", async () => {
    await expect(ProjectPayment.create({ projectId: id(), contractorId: id(), amount: money, paymentType: "INTERIM", date: new Date(), createdBy: id(), status: "PAID" })).resolves.toBeTruthy();
    await expect(ProjectPayment.create({ projectId: id(), contractorId: id(), amount: money, paymentType: "INTERIM", date: new Date(), createdBy: id(), status: "PAID", paymentNo: "PAY-2026-000010" })).rejects.toThrow(/payment reference/);
  });

  it("atomic counter numbers never repeat under concurrency", async () => {
    const { nextNumber } = await import("../src/shared/database/counter.js");
    const nos = await Promise.all(Array.from({ length: 20 }, () => nextNumber("PAY", new Date("2026-05-01"))));
    expect(new Set(nos).size).toBe(20);
    expect(nos.sort()[0]).toBe("PAY-2026-000001");
  });

  it("backfill: dry-run writes nothing; commit creates initial revisions and payment numbers; second run changes nothing", async () => {
    const p = await project();
    await project({ budget: { amountMinor: 0, currency: "LKR" } });
    await ProjectPayment.create({ projectId: p._id, contractorId: id(), amount: money, paymentType: "INTERIM", date: dates.start, createdBy: id(), status: "PAID" });
    const dry = await backfillFinance(false);
    expect(dry).toMatchObject({ mode: "dry-run", initialRevisionsToCreate: 1, paymentsToUpdate: 1, initialRevisionsCreated: 0 });
    expect(await ProjectBudgetRevision.countDocuments()).toBe(0);
    const done = await backfillFinance(true);
    expect(done).toMatchObject({ initialRevisionsCreated: 1, paymentsUpdated: 1 });
    const rev = (await ProjectBudgetRevision.findOne({ projectId: p._id }))!;
    expect(rev).toMatchObject({ kind: "INITIAL", status: "APPROVED", sequence: 1, decisionNote: "Backfilled from project budget" });
    expect(rev.newTotal.amountMinor).toBe(money.amountMinor);
    const pay = (await ProjectPayment.findOne({ projectId: p._id }))!;
    expect(pay.paymentNo).toMatch(/^PAY-\d{4}-\d{6}$/);
    expect(pay.paidAt).toBeTruthy();
    expect(pay.paymentReference).toBeUndefined(); // never invented
    expect(await backfillFinance(true)).toMatchObject({ initialRevisionsCreated: 0, paymentsUpdated: 0 });
  });
});
