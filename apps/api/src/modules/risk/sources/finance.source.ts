import mongoose, { type ClientSession } from "mongoose";
import { ProjectBudgetRevision } from "../../finance/models/project-budget-revision.model.js";
import { ProjectExpense } from "../../finance/models/project-expense.model.js";
import { ProjectPayment } from "../../finance/models/project-payment.model.js";
import { Project } from "../../projects/models/project.model.js";
import { calendarDaysBetween, colomboDayStart } from "../engine/math.js";
import type { FinanceInputData, SourceEnvelope } from "../engine/types.js";

export async function fetchFinanceSource(
  projectId: string,
  now: Date,
  session?: ClientSession,
): Promise<SourceEnvelope<FinanceInputData>> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      available: false,
      asOf: null,
      reasonKey: "invalid_project_id",
    };
  }

  const objId = new mongoose.Types.ObjectId(projectId);
  const today = colomboDayStart(now);

  const project = await Project.findById(objId)
    .select("budget")
    .session(session ?? null)
    .lean();

  if (!project) {
    return {
      available: false,
      asOf: null,
      reasonKey: "project_not_found",
    };
  }

  // 1. Budget Revisions
  const revisions = await ProjectBudgetRevision.find({ projectId: objId })
    .sort({ sequence: 1 })
    .session(session ?? null)
    .lean();

  let approvedRevisionsCount = 0;
  let cumulativeBudgetIncreaseMinor = 0;
  let pendingRevisionsCount = 0;
  let oldestPendingRevisionDays = 0;
  let currentBudgetMinor = project.budget?.amountMinor ?? 0;

  for (const rev of revisions) {
    if (rev.status === "APPROVED") {
      if (rev.kind === "REVISION") {
        approvedRevisionsCount++;
        const diff = (rev.newTotal?.amountMinor ?? 0) - (rev.previousTotal?.amountMinor ?? 0);
        if (diff > 0) {
          cumulativeBudgetIncreaseMinor += diff;
        }
      }
      if (rev.newTotal?.amountMinor) {
        currentBudgetMinor = rev.newTotal.amountMinor;
      }
    } else if (rev.status === "PENDING_APPROVAL") {
      pendingRevisionsCount++;
      const reqDate = rev.requestedAt ? new Date(rev.requestedAt) : new Date(rev.createdAt ?? now);
      const days = Math.max(0, calendarDaysBetween(reqDate, today));
      if (days > oldestPendingRevisionDays) {
        oldestPendingRevisionDays = days;
      }
    }
  }

  // 2. Payments (PAID, APPROVED = committed, PENDING)
  const payments = await ProjectPayment.find({ projectId: objId })
    .session(session ?? null)
    .lean();

  let paidPaymentsMinor = 0;
  let committedPaymentsMinor = 0;
  let pendingPaymentApprovalsCount = 0;
  let oldestPendingPaymentApprovalDays = 0;
  let largestSingleTransactionMinor = 0;

  interface DatedTransaction {
    amountMinor: number;
    date: Date;
  }
  const completedTransactions: DatedTransaction[] = [];

  for (const p of payments) {
    const amt = p.amount?.amountMinor ?? 0;
    if (p.status === "PAID" && !p.reversal) {
      paidPaymentsMinor += amt;
      if (amt > largestSingleTransactionMinor) {
        largestSingleTransactionMinor = amt;
      }
      const pDate = p.paidAt ? new Date(p.paidAt) : new Date(p.date ?? now);
      completedTransactions.push({ amountMinor: amt, date: pDate });
    } else if (p.status === "APPROVED" && !p.reversal) {
      committedPaymentsMinor += amt;
    } else if (p.status === "PENDING") {
      pendingPaymentApprovalsCount++;
      const reqDate = p.requestedAt ? new Date(p.requestedAt) : new Date(p.createdAt ?? now);
      const days = Math.max(0, calendarDaysBetween(reqDate, today));
      if (days > oldestPendingPaymentApprovalDays) {
        oldestPendingPaymentApprovalDays = days;
      }
    }
  }

  // 3. Expenses (VERIFIED, PENDING_VERIFICATION)
  const expenses = await ProjectExpense.find({ projectId: objId })
    .session(session ?? null)
    .lean();

  let verifiedExpensesMinor = 0;
  let unverifiedExpensesCount = 0;
  let oldestUnverifiedExpenseDays = 0;

  for (const e of expenses) {
    const amt = e.amount?.amountMinor ?? 0;
    if (e.status === "VERIFIED" && !e.reversal) {
      verifiedExpensesMinor += amt;
      if (amt > largestSingleTransactionMinor) {
        largestSingleTransactionMinor = amt;
      }
      const eDate = e.verifiedAt ? new Date(e.verifiedAt) : new Date(e.expenseDate ?? now);
      completedTransactions.push({ amountMinor: amt, date: eDate });
    } else if (e.status === "PENDING_VERIFICATION") {
      unverifiedExpensesCount++;
      const subDate = e.submittedAt ? new Date(e.submittedAt) : new Date(e.createdAt ?? now);
      const days = Math.max(0, calendarDaysBetween(subDate, today));
      if (days > oldestUnverifiedExpenseDays) {
        oldestUnverifiedExpenseDays = days;
      }
    }
  }

  // 4. Time series calculations: last 30 days and trailing full months
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  let last30DaysSpendMinor = 0;

  for (const t of completedTransactions) {
    if (t.date >= thirtyDaysAgo && t.date <= today) {
      last30DaysSpendMinor += t.amountMinor;
    }
  }

  // Trailing monthly spend buckets (last 3 full calendar months before current month)
  const trailingMonthlySpendMinor: number[] = [];
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth();

  for (let i = 1; i <= 3; i++) {
    const targetMonthDate = new Date(Date.UTC(currentYear, currentMonth - i, 1));
    const nextMonthDate = new Date(Date.UTC(currentYear, currentMonth - i + 1, 1));
    let monthTotal = 0;
    for (const t of completedTransactions) {
      if (t.date >= targetMonthDate && t.date < nextMonthDate) {
        monthTotal += t.amountMinor;
      }
    }
    trailingMonthlySpendMinor.push(monthTotal);
  }

  const spentMinor = paidPaymentsMinor + verifiedExpensesMinor;
  const committedMinor = committedPaymentsMinor;

  const data: FinanceInputData = {
    budgetMinor: currentBudgetMinor,
    spentMinor,
    committedMinor,
    approvedRevisionsCount,
    cumulativeBudgetIncreaseMinor,
    pendingRevisionsCount,
    oldestPendingRevisionDays,
    pendingPaymentApprovalsCount,
    oldestPendingPaymentApprovalDays,
    unverifiedExpensesCount,
    oldestUnverifiedExpenseDays,
    largestSingleTransactionMinor,
    trailingMonthlySpendMinor,
    last30DaysSpendMinor,
  };

  return {
    available: true,
    asOf: new Date(),
    data,
  };
}
