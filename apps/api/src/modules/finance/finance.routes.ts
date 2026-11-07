import { Router } from "express";

import { handle, invalid, limiter, noStore, param, reply, sendFailure } from "../contractors/contractor.http.js";
import { parseStrict } from "../contractors/contractor.schema.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { cancelRevision, decideRevision, listRevisions, previewRevision, requestRevision } from "./budget.service.js";
import { createExpense, getExpense, listExpenses, transitionExpense, updateExpense } from "./expense.service.js";
import { contractorFinance, exportExpensesCsv, exportPaymentsCsv, financeProjects, financeSummary, projectFinance, projectLedger } from "./finance-dashboard.service.js";
import {
  approveBody, decisionBody, expenseBody, expenseExportQuery, expenseListQuery, expensePatch, exportQuery, ledgerQuery, markPaidBody, paymentBody, paymentListQuery, paymentPatch, previewGatesQuery,
  projectsQuery, reasonBody, rejectBody, revisionBody, summaryQuery,
} from "./finance.schema.js";
import { getPayment, listPayments, previewGates, requestPayment, transitionPayment, updatePayment } from "./payment.service.js";

/** Mounted at /api/v1/finance. Every route: session, permission, strict input, no-store; scope and maker-checker are enforced in the services, inside transactions. */
export const financeRouter = Router();
const read = limiter(240);
const write = limiter(60);
const exportLimit = limiter(10);
const auth = [requireAuthenticated];
const perm = (p: Parameters<typeof requirePermission>[0], l = read) => [...auth, requirePermission(p), l];

financeRouter.get("/summary", ...perm("finance.budget.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(summaryQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await financeSummary(actor, q));
}));

financeRouter.get("/projects", ...perm("finance.budget.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(projectsQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await financeProjects(actor, q));
}));
financeRouter.get("/projects/:projectId", ...perm("finance.budget.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await projectFinance(actor, param(req.params.projectId)));
}));
financeRouter.get("/projects/:projectId/ledger", ...auth, read, handle({}, async (req, res, actor) => {
  const q = parseStrict(ledgerQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await projectLedger(actor, param(req.params.projectId), q));
}));

/* budget revisions */
financeRouter.get("/projects/:projectId/budget/revisions", ...perm("finance.budget.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await listRevisions(actor, param(req.params.projectId)));
}));
financeRouter.post("/projects/:projectId/budget/revisions/preview", ...perm("finance.budget.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = revisionBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await previewRevision(actor, param(req.params.projectId), b.data));
}));
financeRouter.post("/projects/:projectId/budget/revisions", ...perm("finance.budget.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = revisionBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await requestRevision(actor, param(req.params.projectId), b.data, req.requestId), 201);
}));
financeRouter.post("/projects/:projectId/budget/revisions/:id/approve", ...perm("finance.budget.approve", write), handle({ body: true }, async (req, res, actor) => {
  const b = decisionBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await decideRevision(actor, param(req.params.projectId), param(req.params.id), "approve", b.data.note, req.requestId));
}));
financeRouter.post("/projects/:projectId/budget/revisions/:id/reject", ...perm("finance.budget.approve", write), handle({ body: true }, async (req, res, actor) => {
  const b = rejectBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await decideRevision(actor, param(req.params.projectId), param(req.params.id), "reject", b.data.note, req.requestId));
}));
financeRouter.post("/projects/:projectId/budget/revisions/:id/cancel", ...perm("finance.budget.update", write), handle({ body: true }, async (req, res, actor) => {
  if (Object.keys(req.body ?? {}).length) return invalid(res, req);
  reply(res, req, await cancelRevision(actor, param(req.params.projectId), param(req.params.id), req.requestId));
}));

/* expenses */
financeRouter.get("/expenses", ...perm("finance.expense.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(expenseListQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listExpenses(actor, q));
}));
financeRouter.get("/expenses/:id", ...perm("finance.expense.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await getExpense(actor, param(req.params.id)));
}));
financeRouter.post("/projects/:projectId/expenses", ...perm("finance.expense.create", write), handle({ body: true }, async (req, res, actor) => {
  const b = expenseBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await createExpense(actor, param(req.params.projectId), b.data, req.requestId), 201);
}));
financeRouter.patch("/expenses/:id", ...perm("finance.expense.create", write), handle({ body: true }, async (req, res, actor) => {
  const b = expensePatch.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await updateExpense(actor, param(req.params.id), b.data, req.requestId));
}));
financeRouter.post("/expenses/:id/submit", ...perm("finance.expense.create", write), handle({ body: true }, async (req, res, actor) => {
  if (Object.keys(req.body ?? {}).length) return invalid(res, req);
  reply(res, req, await transitionExpense(actor, param(req.params.id), { action: "submit" }, req.requestId));
}));
financeRouter.post("/expenses/:id/verify", ...perm("finance.expense.verify", write), handle({ body: true }, async (req, res, actor) => {
  if (Object.keys(req.body ?? {}).length) return invalid(res, req);
  reply(res, req, await transitionExpense(actor, param(req.params.id), { action: "verify" }, req.requestId));
}));
financeRouter.post("/expenses/:id/reject", ...perm("finance.expense.verify", write), handle({ body: true }, async (req, res, actor) => {
  const b = reasonBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await transitionExpense(actor, param(req.params.id), { action: "reject", note: b.data.reason }, req.requestId));
}));
financeRouter.post("/expenses/:id/reverse", ...perm("finance.expense.verify", write), handle({ body: true }, async (req, res, actor) => {
  const b = reasonBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await transitionExpense(actor, param(req.params.id), { action: "reverse", note: b.data.reason }, req.requestId));
}));

/* payments */
financeRouter.get("/payments/preview-gates", ...perm("finance.payment.create"), handle({}, async (req, res, actor) => {
  const q = parseStrict(previewGatesQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await previewGates(actor, q));
}));
financeRouter.get("/payments", ...perm("finance.payment.read"), handle({}, async (req, res, actor) => {
  const q = parseStrict(paymentListQuery, req.query);
  if (!q) return invalid(res, req);
  reply(res, req, await listPayments(actor, q));
}));
financeRouter.get("/payments/:id", ...perm("finance.payment.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await getPayment(actor, param(req.params.id)));
}));
financeRouter.post("/projects/:projectId/payments", ...perm("finance.payment.create", write), handle({ body: true }, async (req, res, actor) => {
  const b = paymentBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await requestPayment(actor, param(req.params.projectId), b.data, req.requestId), 201);
}));
financeRouter.patch("/payments/:id", ...perm("finance.payment.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = paymentPatch.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await updatePayment(actor, param(req.params.id), b.data, req.requestId));
}));
financeRouter.post("/payments/:id/approve", ...perm("finance.payment.approve", write), handle({ body: true }, async (req, res, actor) => {
  const b = approveBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await transitionPayment(actor, param(req.params.id), { action: "approve", note: b.data.note, acknowledgeWarnings: b.data.acknowledgeWarnings }, req.requestId));
}));
financeRouter.post("/payments/:id/reject", ...perm("finance.payment.reject", write), handle({ body: true }, async (req, res, actor) => {
  const b = rejectBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await transitionPayment(actor, param(req.params.id), { action: "reject", note: b.data.note }, req.requestId));
}));
financeRouter.post("/payments/:id/cancel", ...auth, write, handle({ body: true }, async (req, res, actor) => {
  const b = reasonBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await transitionPayment(actor, param(req.params.id), { action: "cancel", note: b.data.reason }, req.requestId));
}));
financeRouter.post("/payments/:id/mark-paid", ...perm("finance.payment.update", write), handle({ body: true }, async (req, res, actor) => {
  const b = markPaidBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await transitionPayment(actor, param(req.params.id), { action: "mark-paid", paidAt: b.data.paidAt, paymentReference: b.data.paymentReference }, req.requestId));
}));
financeRouter.post("/payments/:id/reverse", ...perm("finance.payment.approve", write), handle({ body: true }, async (req, res, actor) => {
  const b = reasonBody.safeParse(req.body);
  if (!b.success) return invalid(res, req);
  reply(res, req, await transitionPayment(actor, param(req.params.id), { action: "reverse", note: b.data.reason }, req.requestId));
}));

/* contractor summary, exports */
financeRouter.get("/contractors/:contractorId/summary", ...perm("finance.payment.read"), handle({}, async (req, res, actor) => {
  if (Object.keys(req.query).length) return invalid(res, req);
  reply(res, req, await contractorFinance(actor, param(req.params.contractorId)));
}));

function sendCsv(res: import("express").Response, req: import("express").Request, result: Awaited<ReturnType<typeof exportPaymentsCsv>>, name: string) {
  if (!result.ok) return sendFailure(res, req, result);
  noStore(res);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
  res.setHeader("X-Row-Count", String(result.data.rows));
  res.status(200).send(result.data.csv);
}
financeRouter.get("/export/payments.csv", ...perm("finance.report.export", exportLimit), handle({}, async (req, res, actor) => {
  const q = parseStrict(exportQuery, req.query);
  if (!q) return invalid(res, req);
  sendCsv(res, req, await exportPaymentsCsv(actor, q, req.requestId), "payments");
}));
financeRouter.get("/export/expenses.csv", ...perm("finance.report.export", exportLimit), handle({}, async (req, res, actor) => {
  const q = parseStrict(expenseExportQuery, req.query);
  if (!q) return invalid(res, req);
  sendCsv(res, req, await exportExpensesCsv(actor, q, req.requestId), "expenses");
}));
