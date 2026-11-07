import { EXPENSE_STATUSES, FINANCE_CATEGORIES } from "@infraos/shared-types";
import { z } from "zod";

import { objectId, reasonText, text } from "../contractors/contractor.schema.js";
import { parseAmountToMinor } from "./finance.money.js";
import { PAYMENT_STATUSES, PAYMENT_TYPES } from "./finance.constants.js";

/** Amounts arrive as decimal strings ("1250000.50"): max 2 dp, 15 integer digits, positive. Extra decimals are rejected, never rounded. */
export const amountField = z.string().trim().refine((v) => parseAmountToMinor(v) !== null, "invalid amount").transform((v) => parseAmountToMinor(v) as number);
const category = z.enum(FINANCE_CATEGORIES);
const day = z.coerce.date();
const optText = (max: number) => z.string().trim().max(max).optional();

export const allocationInput = z.object({ category, amount: amountField }).strict();
const allocations = z.array(allocationInput).max(15).refine((a) => new Set(a.map((x) => x.category)).size === a.length, "duplicate category");

export const revisionBody = z.object({ newTotal: amountField, allocations: allocations.default([]), reason: reasonText }).strict();
export const decisionBody = z.object({ note: reasonText.optional() }).strict();
export const rejectBody = z.object({ note: reasonText }).strict();

export const expenseBody = z.object({
  category, description: text(500), expenseDate: day, amount: amountField, contractorId: objectId.optional(), assignmentId: objectId.optional(),
  supplierName: optText(120), supportingRef: text(80), documentIds: z.array(objectId).max(10).default([]),
}).strict();
export const expensePatch = expenseBody.partial().strict().refine((v) => Object.keys(v).length > 0, "nothing to update");

export const paymentBody = z.object({
  contractorId: objectId, assignmentId: objectId.optional(), paymentType: z.enum(PAYMENT_TYPES), amount: amountField, invoiceReference: text(80), date: day, description: optText(500),
}).strict();
export const paymentPatch = paymentBody.omit({ contractorId: true }).partial().strict().refine((v) => Object.keys(v).length > 0, "nothing to update");
export const approveBody = z.object({ note: reasonText.optional(), acknowledgeWarnings: z.boolean().optional() }).strict();
export const markPaidBody = z.object({ paidAt: day, paymentReference: text(80) }).strict();
export const reasonBody = z.object({ reason: reasonText }).strict();

const num = (min: number, max: number) => z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().int().min(min).max(max));
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const csvOf = <T extends string>(allowed: readonly T[]) => z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.enum(allowed as unknown as [T, ...T[]])).max(allowed.length));
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amountQ = z.string().regex(/^\d{1,15}(\.\d{1,2})?$/).transform((v) => parseAmountToMinor(v) ?? 0);

export const summaryQuery = z.object({ agencyId: objectId.optional(), projectStatus: z.string().regex(/^[A-Z_]{3,20}$/).optional(), dateFrom: dateStr.optional(), dateTo: dateStr.optional() }).strict();
export const FLAG_CODES = ["OVER_BUDGET_COMMITMENT", "NEAR_BUDGET", "SPEND_AHEAD_OF_PROGRESS", "PAYMENT_WITHOUT_VERIFIED_PROGRESS", "PENDING_PAYMENT_BACKLOG", "CONTRACT_VALUE_EXCEEDED", "LARGE_UNALLOCATED_BUDGET", "PHYSICAL_AHEAD_OF_SPEND", "BUDGET_REVISION_PENDING", "CATEGORY_OVERSPEND"] as const;
export const projectsQuery = z.object({
  q: z.string().trim().max(80).optional(), agencyId: objectId.optional(), status: z.string().regex(/^[A-Z_]{3,20}$/).optional(), flag: z.enum(FLAG_CODES).optional(), overBudget: bool.optional(),
  basis: z.enum(["VERIFIED_INSPECTION", "REPORTED_UNVERIFIED", "NONE"]).optional(), sort: z.enum(["code", "budget", "utilization", "gap"]).default("code"), page: num(1, 10_000).default(1), limit: num(1, 50).default(20),
}).strict();
export const ledgerQuery = z.object({ cursor: z.string().regex(/^o\d{1,5}$/).optional(), limit: num(1, 50).default(25), type: z.enum(["budget", "expense", "payment"]).optional() }).strict();
export const expenseListQuery = z.object({
  projectId: objectId.optional(), category: category.optional(), status: csvOf(EXPENSE_STATUSES).optional(), contractorId: objectId.optional(), dateFrom: dateStr.optional(), dateTo: dateStr.optional(),
  amountMin: amountQ.optional(), amountMax: amountQ.optional(), q: z.string().trim().max(60).optional(), needsMyVerification: bool.optional(), sort: z.enum(["date", "amount"]).default("date"), page: num(1, 10_000).default(1), limit: num(1, 50).default(20),
}).strict();
export const paymentListQuery = z.object({
  projectId: objectId.optional(), status: csvOf(PAYMENT_STATUSES).optional(), type: z.enum(PAYMENT_TYPES).optional(), contractorId: objectId.optional(), agencyId: objectId.optional(), dateFrom: dateStr.optional(), dateTo: dateStr.optional(),
  amountMin: amountQ.optional(), amountMax: amountQ.optional(), q: z.string().trim().max(60).optional(), needsMyApproval: bool.optional(), sort: z.enum(["date", "amount"]).default("date"), page: num(1, 10_000).default(1), limit: num(1, 50).default(20),
}).strict();
export const previewGatesQuery = z.object({ projectId: objectId, contractorId: objectId, assignmentId: objectId.optional(), paymentType: z.enum(PAYMENT_TYPES), amount: amountQ, invoiceReference: z.string().trim().max(80).optional() }).strict();
export const exportQuery = paymentListQuery.omit({ page: true, limit: true, sort: true, needsMyApproval: true }).extend({ status: csvOf(PAYMENT_STATUSES).optional() }).strict();
export const expenseExportQuery = expenseListQuery.omit({ page: true, limit: true, sort: true, needsMyVerification: true }).strict();

export type RevisionBody = z.infer<typeof revisionBody>;
export type ExpenseBody = z.infer<typeof expenseBody>;
export type PaymentBody = z.infer<typeof paymentBody>;
