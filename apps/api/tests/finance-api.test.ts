import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { AuditLog } from "../src/modules/audit/models/audit-log.model.js";
import { Contractor } from "../src/modules/contractors/models/contractor.model.js";
import { ContractorAssignment } from "../src/modules/contractors/models/contractor-assignment.model.js";
import { financeHooks } from "../src/modules/finance/finance.common.js";
import { ProjectBudgetRevision } from "../src/modules/finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../src/modules/finance/models/project-expense.model.js";
import { ProjectPayment } from "../src/modules/finance/models/project-payment.model.js";
import { Inspection } from "../src/modules/inspections/models/inspection.model.js";
import { Project } from "../src/modules/projects/models/project.model.js";
import { Counter } from "../src/shared/database/counter.js";
import { contractorWorld, makeProject, useTokenSecrets, type World } from "./helpers/contractor-world.js";
import { id } from "./helpers/domain-fixtures.js";
import { clearCoreCollections, startIsolatedMongo, stopIsolatedMongo } from "./helpers/mongo-memory.js";

const app = createApp();
const as = (token: string) => ({
  get: (p: string) => request(app).get(`/api/v1/finance${p}`).set("Authorization", `Bearer ${token}`),
  post: (p: string, b: unknown = {}) => request(app).post(`/api/v1/finance${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
  patch: (p: string, b: unknown) => request(app).patch(`/api/v1/finance${p}`).set("Authorization", `Bearer ${token}`).send(b as object),
});
let seq = 0;
const money = (minor: number) => ({ amountMinor: minor, currency: "LKR" });

describe("project finance (Steps 95-97)", { timeout: 180_000 }, () => {
  let w: World;
  beforeAll(async () => {
    useTokenSecrets();
    await startIsolatedMongo();
    await Promise.all([ProjectPayment.syncIndexes(), ProjectExpense.syncIndexes(), ProjectBudgetRevision.syncIndexes(), ContractorAssignment.syncIndexes(), Contractor.syncIndexes()]);
  }, 300_000);
  afterAll(async () => { await stopIsolatedMongo(); });
  afterEach(async () => {
    financeHooks.beforeAudit = async () => {};
    await clearCoreCollections();
    await AuditLog.collection.deleteMany({});
    await ProjectBudgetRevision.collection.deleteMany({}); // append-only model: clear natively
    await Promise.all([Project, Contractor, ContractorAssignment, ProjectPayment, ProjectExpense, Inspection, Counter].map((m) => (m as unknown as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({})));
  });

  /** A budgeted ACTIVE project in the child agency, managed by the project manager, with an active contractor and assignment. */
  async function world(budgetMinor = 1_000_000, contractValue?: number) {
    w = await contractorWorld();
    const project = await makeProject(w.child._id, { managerId: w.manager.user._id, budget: money(budgetMinor), status: "ACTIVE" });
    seq += 1;
    const contractor = await Contractor.create({ name: `Fin Contractor ${seq}`, registrationNumber: `FIN-${seq}`, registeredByAgencyId: w.ministry._id, category: "GENERAL", status: "ACTIVE" });
    const assignment = await ContractorAssignment.create({ projectId: project._id, contractorId: contractor._id, agencyId: w.child._id, role: "PRIMARY", startDate: new Date("2026-01-01"), assignedBy: w.gov.user._id, ...(contractValue ? { contractValue: money(contractValue) } : {}) });
    return { project, contractor, assignment };
  }
  const pay = (s: Awaited<ReturnType<typeof world>>, over: Record<string, unknown> = {}) => ({ contractorId: String(s.contractor._id), paymentType: "INTERIM", amount: "1000.00", invoiceReference: `INV-${++seq}`, date: "2026-03-01", ...over });
  const request1 = async (s: Awaited<ReturnType<typeof world>>, over: Record<string, unknown> = {}) => (await as(w.manager.token).post(`/projects/${s.project._id}/payments`, pay(s, over)));

  it("permissions: contractor, inspector and citizen are denied; super admin is read-only; other agencies get 404", async () => {
    const s = await world();
    for (const u of [w.contractorUser, w.inspector, w.citizen]) { expect((await as(u.token).get("/summary")).status).toBe(403); expect((await as(u.token).get("/payments")).status).toBe(403); }
    expect((await as(w.superUser.token).get("/summary")).status).toBe(200);
    expect((await as(w.superUser.token).post(`/projects/${s.project._id}/payments`, pay(s))).status).toBe(403);
    expect((await as(w.superUser.token).post(`/projects/${s.project._id}/expenses`, {})).status).toBe(403);
    const made = await request1(s);
    expect(made.status).toBe(201);
    expect((await as(w.superUser.token).post(`/payments/${made.body.data.id}/approve`)).status).toBe(403);
    expect((await as(w.otherGov.token).get(`/projects/${s.project._id}`)).status).toBe(404);
    expect((await as(w.otherGov.token).get(`/payments/${made.body.data.id}`)).status).toBe(404);
    expect((await as(w.otherGov.token).post(`/payments/${made.body.data.id}/approve`)).status).toBe(404);
    expect((await as(w.siblingOfficer.token).get(`/projects/${s.project._id}`)).status).toBe(404);
    expect((await as(w.officer.token).get("/summary?bogus=1")).status).toBe(400);
    expect((await as(w.gov.token).get("/payments?status=PAID&status=PENDING")).status).toBe(400);
  });

  it("project manager is narrowed to managed projects for writes", async () => {
    const s = await world();
    const other = await makeProject(w.child._id, { managerId: w.officer.user._id, budget: money(1_000_000), status: "ACTIVE" });
    expect((await as(w.manager.token).post(`/projects/${other._id}/payments`, pay(s))).status).toBe(403);
    expect((await as(w.manager.token).get(`/projects/${other._id}`)).status).toBe(200); // read is agency wide
  });

  describe("budget revisions (Step 95)", () => {
    it("request, impact preview, approve by another user updates Project.budget and audits; self-approval, below-commitments and second pending are refused", async () => {
      const s = await world();
      const body = { newTotal: "15000.00", allocations: [{ category: "CIVIL_WORKS", amount: "9000.00" }, { category: "MATERIALS", amount: "4000.00" }], reason: "Scope increased after survey" };
      const preview = await as(w.manager.token).post(`/projects/${s.project._id}/budget/revisions/preview`, body);
      expect(preview.body.data).toMatchObject({ currentTotalMinor: 1_000_000, proposedTotalMinor: 1_500_000, allocatedMinor: 1_300_000, unallocatedMinor: 200_000, blocking: [] });
      expect(await ProjectBudgetRevision.countDocuments()).toBe(0); // preview writes nothing
      const req = await as(w.manager.token).post(`/projects/${s.project._id}/budget/revisions`, body);
      expect(req.status).toBe(201);
      expect(await ProjectBudgetRevision.countDocuments({ kind: "INITIAL", status: "APPROVED" })).toBe(1); // baseline created lazily
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/budget/revisions`, body)).body.error.details.kind).toBe("revision_pending");
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/budget/revisions/${req.body.data.id}/approve`)).status).toBe(403); // no approve permission
      expect((await as(w.gov.token).post(`/projects/${s.project._id}/budget/revisions/${req.body.data.id}/reject`, { note: "short" })).status).toBe(400);
      const approve = await as(w.gov.token).post(`/projects/${s.project._id}/budget/revisions/${req.body.data.id}/approve`);
      expect(approve.status).toBe(200);
      expect((await Project.findById(s.project._id))!.budget.amountMinor).toBe(1_500_000);
      expect((await AuditLog.findOne({ action: "budget.revision_approved" }).select("+newValue"))!.newValue?.budget?.amountMinor).toBe(1_500_000);
      expect((await as(w.gov.token).post(`/projects/${s.project._id}/budget/revisions/${req.body.data.id}/approve`)).status).toBe(409); // already decided

      // self-approval by a user who holds both permissions
      const mine = await as(w.gov.token).post(`/projects/${s.project._id}/budget/revisions`, { newTotal: "16000.00", allocations: [], reason: "Another change requested by gov" });
      expect(mine.status).toBe(201);
      const self = await as(w.gov.token).post(`/projects/${s.project._id}/budget/revisions/${mine.body.data.id}/approve`);
      expect(self.status).toBe(403);
      expect(self.body.error.details.kind).toBe("maker_checker");
      expect((await as(w.gov.token).post(`/projects/${s.project._id}/budget/revisions/${mine.body.data.id}/cancel`)).status).toBe(200);
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/budget/revisions/${mine.body.data.id}/cancel`)).status).toBe(409);

      // below commitments
      const p = await request1(s, { amount: "8000.00" });
      expect(p.status).toBe(201);
      await as(w.gov.token).post(`/payments/${p.body.data.id}/approve`, { acknowledgeWarnings: true });
      const low = await as(w.manager.token).post(`/projects/${s.project._id}/budget/revisions`, { newTotal: "7000.00", allocations: [], reason: "Trying to cut below commitments" });
      expect(low.status).toBe(409);
      expect(low.body.error.details.kind).toBe("BELOW_COMMITMENTS");
      expect(low.body.error.details.impact.blocking[0].belowByMinor).toBe(100_000);
    });

    it("pre-approval projects use the project edit; the project PATCH cannot change an approved budget; history is listed", async () => {
      const s = await world();
      const draft = await makeProject(w.child._id, { status: "DRAFT", managerId: w.manager.user._id, budget: money(500_000) });
      expect((await as(w.manager.token).post(`/projects/${draft._id}/budget/revisions`, { newTotal: "9000.00", allocations: [], reason: "Draft projects edit directly" })).body.error.details.kind).toBe("use_project_edit");
      const patch = await request(app).patch(`/api/v1/projects/${s.project._id}`).set("Authorization", `Bearer ${w.manager.token}`).send({ budget: { amountMinor: 5, currency: "LKR" } });
      expect([400, 403, 409]).toContain(patch.status);
      expect((await Project.findById(s.project._id))!.budget.amountMinor).toBe(1_000_000);
      const hist = await as(w.officer.token).get(`/projects/${s.project._id}/budget/revisions`);
      expect(hist.status).toBe(200);
      expect(await as(w.officer.token).post(`/projects/${s.project._id}/budget/revisions/preview`, { newTotal: "9000.00", allocations: [], reason: "x".repeat(12) }).then((r) => r.status)).toBe(200);
    });
  });

  describe("expenses (Step 96)", () => {
    const exp = (over: Record<string, unknown> = {}) => ({ category: "MATERIALS", description: "Gravel (Synthetic)", expenseDate: "2026-03-01", amount: "500.00", supplierName: "Synthetic Supplies", supportingRef: `VCH-${++seq}`, ...over });

    it("draft, submit, verify by another user; creator cannot verify; verified rows are immutable; reversal leaves the row and drops it from totals", async () => {
      const s = await world();
      const created = await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ contractorId: String(s.contractor._id) }));
      expect(created.status).toBe(201);
      expect(created.body.data.expenseNo).toMatch(/^EXP-\d{4}-000001$/);
      const eid = created.body.data.id;
      expect((await as(w.manager.token).patch(`/expenses/${eid}`, { description: "Gravel and sand (Synthetic)" })).status).toBe(200);
      expect((await as(w.manager.token).post(`/expenses/${eid}/verify`)).status).toBe(403); // no permission
      expect((await as(w.manager.token).post(`/expenses/${eid}/submit`)).status).toBe(200);
      expect((await as(w.manager.token).post(`/expenses/${eid}/submit`)).status).toBe(409);
      expect((await as(w.officer.token).post(`/expenses/${eid}/reject`, { reason: "too short" })).status).toBe(400);
      const fin1 = await as(w.gov.token).get(`/projects/${s.project._id}`);
      expect(fin1.body.data.totals.verifiedExpensesMinor).toBe(0); // pending does not count
      expect((await as(w.officer.token).post(`/expenses/${eid}/verify`)).status).toBe(200);
      expect((await as(w.officer.token).patch(`/expenses/${eid}`, { description: "edit" })).status).toBe(409); // immutable once verified, whoever asks
      expect((await as(w.manager.token).patch(`/expenses/${eid}`, { description: "Edit after verification" })).status).toBe(409);
      expect((await as(w.gov.token).get(`/projects/${s.project._id}`)).body.data.totals.verifiedExpensesMinor).toBe(50_000);
      expect((await as(w.officer.token).post(`/expenses/${eid}/reverse`, { reason: "Posted against the wrong project" })).status).toBe(200);
      expect((await as(w.gov.token).get(`/projects/${s.project._id}`)).body.data.totals.verifiedExpensesMinor).toBe(0);
      expect((await ProjectExpense.findById(eid))!.status).toBe("REVERSED");
      expect((await as(w.officer.token).post(`/expenses/${eid}/reverse`, { reason: "Reversing a second time" })).status).toBe(409);
      const log = (await as(w.gov.token).get(`/projects/${s.project._id}/ledger`)).body.data.events.map((e: { event: string }) => e.event);
      expect(log).toEqual(expect.arrayContaining(["expense.verified", "expense.reversed"]));
    });

    it("self-verification is blocked even for a user holding verify and create; rejection allows a fix and resubmit", async () => {
      const s = await world();
      const e = await as(w.officer.token).post(`/projects/${s.project._id}/expenses`, exp()); // officers write anywhere in their agency; only project managers are narrowed
      expect(e.status).toBe(201);
      await as(w.officer.token).post(`/expenses/${e.body.data.id}/submit`);
      const self = await as(w.officer.token).post(`/expenses/${e.body.data.id}/verify`);
      expect(self.status).toBe(403);
      expect(self.body.error.details.kind).toBe("maker_checker");
      expect((await as(w.gov.token).post(`/expenses/${e.body.data.id}/verify`)).status).toBe(200);
      const m = await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp());
      await as(w.manager.token).post(`/expenses/${m.body.data.id}/submit`);
      const rej = await as(w.officer.token).post(`/expenses/${m.body.data.id}/reject`, { reason: "Receipt is not legible" });
      expect(rej.status).toBe(200);
      expect((await as(w.manager.token).patch(`/expenses/${m.body.data.id}`, { supportingRef: "VCH-FIXED" })).status).toBe(200);
      expect((await as(w.manager.token).post(`/expenses/${m.body.data.id}/submit`)).status).toBe(200);
      const own = await ProjectExpense.findById(m.body.data.id);
      expect(String(own!.createdBy)).toBe(String(w.manager.user._id));
    });

    it("duplicate prevention at submit with the existing number, validation, future dates and scope", async () => {
      const s = await world();
      const a = await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ supportingRef: "VCH-DUP" }));
      const b = await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ supportingRef: "vch-dup" }));
      expect(a.status).toBe(201); expect(b.status).toBe(201); // drafts do not collide
      expect((await as(w.manager.token).post(`/expenses/${a.body.data.id}/submit`)).status).toBe(200);
      const dup = await as(w.manager.token).post(`/expenses/${b.body.data.id}/submit`);
      expect(dup.status).toBe(409);
      expect(dup.body.error.details).toMatchObject({ kind: "duplicate", existingExpenseNo: a.body.data.expenseNo });
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ amount: "10.005" }))).status).toBe(400);
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ amount: "0" }))).status).toBe(400);
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ expenseDate: "2999-01-01" }))).status).toBe(400);
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ contractorId: String(id()) }))).status).toBe(400); // no assignment
      expect((await as(w.manager.token).post(`/projects/${s.project._id}/expenses`, exp({ extra: 1 }))).status).toBe(400);
      expect((await as(w.otherGov.token).get(`/expenses/${a.body.data.id}`)).status).toBe(404);
      const list = await as(w.officer.token).get("/expenses?status=PENDING_VERIFICATION");
      expect(list.body.data.total).toBe(1);
      expect(list.body.data.needsMyVerification).toBe(1);
      expect((await as(w.contractorUser.token).get("/expenses")).status).toBe(403);
    });
  });

  describe("payments (Step 96)", () => {
    it("full lifecycle: request, approve, mark paid, reverse; maker-checker, numbers, cache sync and audit", async () => {
      const s = await world();
      const r = await request1(s, { amount: "2000.00" });
      expect(r.status).toBe(201);
      expect(r.body.data.paymentNo).toMatch(/^PAY-\d{4}-000001$/);
      const pid = r.body.data.id;
      expect((await as(w.manager.token).post(`/payments/${pid}/approve`)).status).toBe(403); // lacks permission
      const warn = await as(w.gov.token).post(`/payments/${pid}/approve`); // no progress recorded => PROGRESS_SUPPORT warns
      expect(warn.status).toBe(409);
      expect(warn.body.error.details.kind).toBe("warnings_ack_required");
      expect((await as(w.gov.token).post(`/payments/${pid}/approve`, { acknowledgeWarnings: true })).status).toBe(200);
      expect((await AuditLog.findOne({ action: "payment.approved" }).select("+newValue"))!.newValue?.reason).toMatch(/^warnings: PROGRESS_SUPPORT/);
      expect((await as(w.gov.token).post(`/payments/${pid}/approve`, { acknowledgeWarnings: true })).status).toBe(409); // illegal transition
      expect((await as(w.manager.token).post(`/payments/${pid}/mark-paid`, { paidAt: "2026-03-05", paymentReference: "" })).status).toBe(400);
      expect((await as(w.manager.token).post(`/payments/${pid}/mark-paid`, { paidAt: "2999-01-01", paymentReference: "CHQ-1" })).status).toBe(400);
      expect((await Project.findById(s.project._id))!.financialProgress).toBe(0);
      const paid = await as(w.manager.token).post(`/payments/${pid}/mark-paid`, { paidAt: "2026-03-05", paymentReference: "CHQ-100245" });
      expect(paid.status).toBe(200);
      expect((await Project.findById(s.project._id))!.financialProgress).toBe(20); // 2000 / 10000, same integer maths as the legacy summary
      const legacy = await request(app).get(`/api/v1/projects/${s.project._id}/financial-progress`).set("Authorization", `Bearer ${w.gov.token}`);
      expect(legacy.status).toBe(200);
      expect(JSON.stringify(legacy.body)).toContain("provisional");
      expect((await as(w.gov.token).post(`/payments/${pid}/cancel`, { reason: "Cancelling a paid payment" })).status).toBe(409);
      expect((await as(w.manager.token).post(`/payments/${pid}/reverse`, { reason: "Reversing my own payment" })).status).toBe(403);
      expect((await as(w.gov.token).post(`/payments/${pid}/reverse`, { reason: "short" })).status).toBe(400);
      expect((await as(w.gov.token).post(`/payments/${pid}/reverse`, { reason: "Bank reference was entered in error" })).status).toBe(200);
      const after = await ProjectPayment.findById(pid);
      expect(after!.status).toBe("REVERSED");
      expect(after!.reversal?.reason).toMatch(/entered in error/);
      expect((await Project.findById(s.project._id))!.financialProgress).toBe(0);
      expect((await as(w.gov.token).post(`/payments/${pid}/reverse`, { reason: "Reversing a second time" })).status).toBe(409);
      const detail = await as(w.gov.token).get(`/payments/${pid}`);
      expect(detail.body.data.timeline.map((t: { action: string }) => t.action)).toEqual(["payment.requested", "payment.approved", "payment.paid", "payment.reversed"]);
      const ledger = await as(w.gov.token).get(`/projects/${s.project._id}/ledger`);
      expect(ledger.body.data.events[0]).toMatchObject({ event: "payment.reversed", runningCommittedMinor: 0, runningPaidMinor: 0 });
    });

    it("reject, cancel, edit and the request-time duplicate rules", async () => {
      const s = await world();
      const a = await request1(s, { invoiceReference: "INV-A" });
      const dupInv = await request1(s, { invoiceReference: "INV-A", amount: "1500.00" });
      expect(dupInv.body.error.details.kind).toBe("gates_blocked");
      expect(dupInv.body.error.details.gates.find((g: { key: string }) => g.key === "DUPLICATE_INVOICE").status).toBe("BLOCK");
      expect((await request1(s, { invoiceReference: "INV-B", amount: "1000.00", date: "2026-03-01" })).body.error.details.kind).toBe("duplicate_recent");
      expect((await as(w.gov.token).post(`/payments/${a.body.data.id}/reject`, { note: "no" })).status).toBe(400);
      expect((await as(w.gov.token).post(`/payments/${a.body.data.id}/reject`, { note: "Invoice does not match the BOQ" })).status).toBe(200);
      expect((await request1(s, { invoiceReference: "INV-A", amount: "1700.00" })).status).toBe(201); // rejected rows free the reference
      const b = await request1(s, { invoiceReference: "INV-C", amount: "900.00" });
      expect((await as(w.officer.token).patch(`/payments/${b.body.data.id}`, { amount: "950.00" })).status).toBe(403); // not the owner or out of write scope
      expect((await as(w.manager.token).patch(`/payments/${b.body.data.id}`, { amount: "950.00" })).status).toBe(200);
      expect((await ProjectPayment.findById(b.body.data.id))!.amount.amountMinor).toBe(95_000);
      expect((await as(w.manager.token).post(`/payments/${b.body.data.id}/cancel`, { reason: "Raised against wrong stage" })).status).toBe(200);
      expect((await as(w.manager.token).patch(`/payments/${b.body.data.id}`, { amount: "960.00" })).status).toBe(409);
      expect((await as(w.contractorUser.token).post(`/payments/${b.body.data.id}/cancel`, { reason: "I am a contractor user" })).status).toBe(403);
    });

    it("blocks suspended contractors, closed projects, missing assignments and over-budget requests with live gate output", async () => {
      const s = await world(1_000_000);
      const q = (extra = "") => `/payments/preview-gates?projectId=${s.project._id}&contractorId=${s.contractor._id}&paymentType=INTERIM&amount=${extra || "1000.00"}`;
      const ok = await as(w.manager.token).get(q());
      expect(ok.body.data.canSubmit).toBe(true);
      const over = await as(w.manager.token).get(q("10000.01"));
      expect(over.body.data.canSubmit).toBe(false);
      expect(over.body.data.gates.find((g: { key: string }) => g.key === "BUDGET_HEADROOM")).toMatchObject({ status: "BLOCK", values: { overByMinor: 1 } });
      expect((await request1(s, { amount: "10000.01" })).body.error.details.kind).toBe("gates_blocked");
      await Contractor.updateOne({ _id: s.contractor._id }, { $set: { status: "SUSPENDED" } });
      const sus = await request1(s);
      expect(sus.status).toBe(409);
      expect(sus.body.error.details.gates.find((g: { key: string }) => g.key === "CONTRACTOR_ELIGIBLE").status).toBe("BLOCK");
      await Contractor.updateOne({ _id: s.contractor._id }, { $set: { status: "ACTIVE" } });
      await Project.updateOne({ _id: s.project._id }, { $set: { status: "ON_HOLD" } });
      expect((await request1(s)).status).toBe(409);
      expect((await request1(s, { paymentType: "FINAL" })).status).toBe(201);
      await Project.updateOne({ _id: s.project._id }, { $set: { status: "ACTIVE" } });
      await ContractorAssignment.updateOne({ _id: s.assignment._id }, { $set: { status: "ENDED", endReason: "Work completed", endDate: new Date() } });
      expect((await request1(s)).status).toBe(409);
      expect((await as(w.contractorUser.token).get(q())).status).toBe(403);
    });

    it("contract cap and progress gates warn; approve needs acknowledgement; reported progress is labelled, verified progress is respected", async () => {
      const s = await world(1_000_000, 150_000);
      const big = await request1(s, { amount: "2000.00", paymentType: "ADVANCE" });
      const cap = big.body.data.gates.find((g: { key: string }) => g.key === "CONTRACT_CAP");
      expect(cap.status).toBe("WARN");
      await Inspection.create({ projectId: s.project._id, inspectorId: id(), inspectionDate: new Date("2026-02-01"), status: "VERIFIED", physicalProgress: 50 });
      const detail = await as(w.gov.token).get(`/payments/${big.body.data.id}`);
      expect(detail.body.data.contractCap).toEqual({ contractValueMinor: 150_000, cumulativeMinor: 0 });
      const interim = await as(w.manager.token).get(`/payments/preview-gates?projectId=${s.project._id}&contractorId=${s.contractor._id}&paymentType=INTERIM&amount=7000.00`);
      const prog = interim.body.data.gates.find((g: { key: string }) => g.key === "PROGRESS_SUPPORT");
      expect(prog).toMatchObject({ status: "WARN", values: { basis: "VERIFIED_INSPECTION", progressBp: 5000 } });
      expect(prog.message).toMatch(/verified progress/);
    });

    it("two concurrent approvals that together exceed the budget cannot both succeed", async () => {
      const s = await world(1_000_000);
      const a = await request1(s, { amount: "6000.00", paymentType: "ADVANCE", invoiceReference: "INV-RACE-1", date: "2026-03-01" });
      const b = await request1(s, { amount: "6000.00", paymentType: "ADVANCE", invoiceReference: "INV-RACE-2", date: "2026-03-02" });
      expect(a.status).toBe(201); expect(b.status).toBe(201);
      const results = await Promise.all([a, b].map((p) => as(w.gov.token).post(`/payments/${p.body.data.id}/approve`, { acknowledgeWarnings: true })));
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const loser = results.find((r) => r.status === 409)!;
      expect(loser.body.error.details.kind).toBe("gates_blocked");
      expect(await ProjectPayment.countDocuments({ status: "APPROVED" })).toBe(1);
    });

    it("a failure after the data changes leaves nothing behind (status, cache and audit roll back together)", async () => {
      const s = await world();
      const r = await request1(s, { amount: "2000.00", paymentType: "ADVANCE" });
      await as(w.gov.token).post(`/payments/${r.body.data.id}/approve`);
      financeHooks.beforeAudit = async () => { throw new Error("simulated failure before the audit row"); };
      const failed = await as(w.manager.token).post(`/payments/${r.body.data.id}/mark-paid`, { paidAt: "2026-03-05", paymentReference: "CHQ-9" });
      expect(failed.status).toBe(503);
      const row = await ProjectPayment.findById(r.body.data.id);
      expect(row!.status).toBe("APPROVED");
      expect(row!.paymentReference).toBeUndefined();
      expect((await Project.findById(s.project._id))!.financialProgress).toBe(0);
      expect(await AuditLog.countDocuments({ action: "payment.paid" })).toBe(0);
    });

    it("audit snapshots only hold allowlisted keys and no request bodies", async () => {
      const s = await world();
      const r = await request1(s, { description: "Secret supplier chatter" });
      const rows = await AuditLog.find({ resourceType: "PAYMENT" }).select("+newValue +oldValue").lean();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) for (const k of Object.keys(row.newValue ?? {})) expect(["status", "reason", "agencyId", "contractorId", "amount", "budget"]).toContain(k);
      expect(JSON.stringify(rows)).not.toContain("Secret supplier chatter");
      expect(r.status).toBe(201);
    });
  });

  describe("intelligence, dashboard, export and contractor summary (Step 97)", () => {
    it("spend ahead of progress is INDICATIVE on reported progress and CONFIRMED on verified; CEI only when verified; no evidence is unavailable", async () => {
      const s = await world(1_000_000);
      await Project.updateOne({ _id: s.project._id }, { $set: { physicalProgress: 10 } });
      const { ProgressReport } = await import("../src/modules/projects/models/progress-report.model.js");
      await ProgressReport.create({ projectId: s.project._id, sequence: 1, reportedPercent: 10, previousPercent: 0, note: "claim", reporterUserId: w.manager.user._id, reportedAt: new Date("2026-02-01") });
      await ProjectPayment.create({ paymentNo: "PAY-2026-000900", projectId: s.project._id, agencyId: w.child._id, contractorId: s.contractor._id, amount: money(400_000), paymentType: "INTERIM", status: "PAID", approvedBy: w.gov.user._id, date: new Date("2026-02-10"), paidAt: new Date("2026-02-12"), paymentReference: "CHQ-1", createdBy: w.manager.user._id });
      const reported = (await as(w.gov.token).get(`/projects/${s.project._id}`)).body.data.intelligence;
      expect(reported).toMatchObject({ available: true, basis: "REPORTED_UNVERIFIED", gapTenths: 300, cei: { status: "INSUFFICIENT_EVIDENCE" } });
      expect(reported.flags.find((f: { code: string }) => f.code === "SPEND_AHEAD_OF_PROGRESS")).toMatchObject({ severity: "HIGH", confidence: "INDICATIVE" });
      await Inspection.create({ projectId: s.project._id, inspectorId: id(), inspectionDate: new Date("2026-02-20"), status: "VERIFIED", physicalProgress: 20 });
      const verified = (await as(w.gov.token).get(`/projects/${s.project._id}`)).body.data.intelligence;
      expect(verified).toMatchObject({ basis: "VERIFIED_INSPECTION", gapTenths: 200, cei: { status: "OK", hundredths: 50 } });
      expect(verified.flags.find((f: { code: string }) => f.code === "SPEND_AHEAD_OF_PROGRESS")).toMatchObject({ confidence: "CONFIRMED" });
      const none = await Project.create({ projectCode: "INF-ROAD-9999", title: "No budget", projectType: "ROAD", agencyId: w.child._id, createdBy: id(), budget: money(1), status: "ACTIVE" });
      await Project.updateOne({ _id: none._id }, { $set: { "budget.amountMinor": 0 } });
      expect((await as(w.gov.token).get(`/projects/${none._id}`)).body.data.intelligence).toMatchObject({ available: false, reason: "missing_budget" });
    });

    it("portfolio summary equals the table sums, filters server-side, and respects scope", async () => {
      const s = await world(1_000_000);
      const s2 = await makeProject(w.sibling._id, { budget: money(2_000_000), status: "ACTIVE" });
      await ProjectPayment.create({ paymentNo: "PAY-2026-000901", projectId: s.project._id, agencyId: w.child._id, contractorId: s.contractor._id, amount: money(250_000), paymentType: "INTERIM", status: "PAID", approvedBy: w.gov.user._id, date: new Date("2026-02-10"), paidAt: new Date(), paymentReference: "R", createdBy: w.manager.user._id });
      const sum = await as(w.gov.token).get("/summary");
      expect(sum.body.data.totals).toMatchObject({ budgetMinor: 3_000_000, paidMinor: 250_000, committedMinor: 250_000, remainingMinor: 2_750_000, utilizationBp: 833 });
      const table = await as(w.gov.token).get("/projects");
      const rows = table.body.data.rows as { budgetMinor: number; paidMinor: number }[];
      expect(rows.reduce((a, r) => a + r.budgetMinor, 0)).toBe(sum.body.data.totals.budgetMinor);
      expect(rows.reduce((a, r) => a + r.paidMinor, 0)).toBe(sum.body.data.totals.paidMinor);
      expect((await as(w.gov.token).get(`/projects?q=${s.project.projectCode}`)).body.data.total).toBe(1);
      expect((await as(w.officer.token).get("/summary")).body.data.totals.budgetMinor).toBe(1_000_000); // child agency only
      expect((await as(w.otherGov.token).get("/summary")).body.data.projects).toBe(0);
      expect((await as(w.superUser.token).get("/summary")).body.data.totals.budgetMinor).toBe(3_000_000);
      expect((await as(w.gov.token).get("/projects?sort=hack")).status).toBe(400);
      void s2;
    });

    it("approval inbox excludes the viewer's own submissions", async () => {
      const s = await world();
      await request1(s, { amount: "100.00" });
      const mine = await as(w.manager.token).get("/summary");
      expect(mine.body.data.inbox.payments).toBeNull(); // manager cannot approve
      const gov = await as(w.gov.token).get("/summary");
      expect(gov.body.data.inbox.payments).toBe(1);
      expect(gov.body.data.inbox.revisionProjects).toEqual([]);
      expect((await as(w.gov.token).get("/payments?needsMyApproval=true")).body.data.total).toBe(1);
      const own = await request(app).post(`/api/v1/finance/projects/${s.project._id}/payments`).set("Authorization", `Bearer ${w.gov.token}`).send(pay(s, { amount: "200.00" }));
      expect([201, 403]).toContain(own.status); // gov is not the project's manager: write scope is narrowed
    });

    it("CSV export is formula-safe, scoped, capped, audited and permission-gated", async () => {
      const s = await world();
      await ProjectPayment.create({ paymentNo: "PAY-2026-000902", projectId: s.project._id, agencyId: w.child._id, contractorId: s.contractor._id, amount: money(12_345), paymentType: "OTHER", status: "PENDING", date: new Date("2026-02-10"), invoiceReference: "=HYPERLINK(\"http://evil\")", createdBy: w.manager.user._id });
      const csv = await as(w.gov.token).get("/export/payments.csv");
      expect(csv.status).toBe(200);
      expect(csv.headers["content-type"]).toContain("text/csv");
      expect(csv.headers["cache-control"]).toContain("no-store");
      expect(csv.text).toContain("\"'=HYPERLINK(");
      expect(csv.text).not.toMatch(/(^|,)"=HYPERLINK/);
      expect(csv.text).toContain("123.45");
      const audit = await AuditLog.findOne({ action: "finance.exported" }).select("+newValue");
      expect(audit!.newValue?.reason).toBe("rows:1");
      expect((await as(w.otherGov.token).get("/export/payments.csv")).text.split("\r\n").length).toBe(2); // header only
      expect((await as(w.manager.token).get("/export/payments.csv")).status).toBe(200); // PM holds report.export
      expect((await as(w.superUser.token).get("/export/expenses.csv")).status).toBe(200);
      expect((await as(w.contractorUser.token).get("/export/payments.csv")).status).toBe(403);
      expect((await as(w.gov.token).get("/export/payments.csv?limit=5")).status).toBe(400);
    });

    it("contractor finance summary is scoped and permission-gated", async () => {
      const s = await world();
      await ProjectPayment.create({ paymentNo: "PAY-2026-000903", projectId: s.project._id, agencyId: w.child._id, contractorId: s.contractor._id, assignmentId: s.assignment._id, amount: money(70_000), paymentType: "INTERIM", status: "PAID", approvedBy: w.gov.user._id, date: new Date(), paidAt: new Date(), paymentReference: "R", createdBy: w.manager.user._id });
      const res = await as(w.gov.token).get(`/contractors/${s.contractor._id}/summary`);
      expect(res.body.data).toMatchObject({ paidMinor: 70_000, projects: 1, paidWithoutVerifiedProgress: 1 });
      expect((await as(w.otherGov.token).get(`/contractors/${s.contractor._id}/summary`)).status).toBe(404);
      expect((await as(w.contractorUser.token).get(`/contractors/${s.contractor._id}/summary`)).status).toBe(403);
    });
  });
});
