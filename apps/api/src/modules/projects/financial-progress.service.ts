import type { Permission } from "@infraos/shared-types";

import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { hasPermission } from "../identity/authorization/require-permission.js";
import { Role } from "../identity/models/role.model.js";
import { User } from "../identity/models/user.model.js";
import { ProjectPayment } from "../finance/models/project-payment.model.js";
import { summarizeRecordedPayments, type FinancialCalculation } from "./financial-progress.policy.js";
import { Project } from "./models/project.model.js";

const READ_PERMISSIONS: Permission[] = ["project.read", "finance.budget.read", "finance.payment.read"];

class FlowControl extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 503, readonly code: "VALIDATION_ERROR" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "SERVICE_UNAVAILABLE") {
    super(code);
  }
}

export class FinancialProgressDependencyError extends Error {}

export const financialProgressHooks: { beforeRead: () => Promise<void> } = {
  beforeRead: async () => {},
};

export type FinancialFailure = { ok: false; status: FlowControl["status"]; code: FlowControl["code"] };

function fail(status: FinancialFailure["status"], code: FinancialFailure["code"]): FinancialFailure {
  return { ok: false, status, code };
}

async function assertLive(actor: AuthenticatedActor): Promise<void> {
  const user = await User.findById(actor.userId).select("roleId status emailVerified credentialEpoch agencyId");
  const epoch = user?.credentialEpoch ?? 0;
  if (!user || user.status !== "ACTIVE" || user.emailVerified !== true || epoch !== actor.credentialEpoch) {
    throw new FlowControl(401, "AUTH_REQUIRED");
  }
  if (!user.roleId || user.roleId.toString() !== actor.roleId) throw new FlowControl(401, "AUTH_REQUIRED");
  const role = await Role.findById(actor.roleId).select("key isActive permissions");
  const granted = Array.isArray(role?.permissions) ? role.permissions : [];
  const allowed = role?.isActive && role.key === actor.roleKey && READ_PERMISSIONS.every((permission) => hasPermission(granted, permission));
  if (!allowed) {
    throw new FlowControl(role?.isActive && role.key === actor.roleKey ? 403 : 401, role?.isActive && role.key === actor.roleKey ? "FORBIDDEN" : "AUTH_REQUIRED");
  }
}

export async function getFinancialProgress(actor: AuthenticatedActor, projectId: string) {
  if (!/^[a-f0-9]{24}$/i.test(projectId)) return fail(400, "VALIDATION_ERROR");
  try {
    await assertLive(actor);
    await financialProgressHooks.beforeRead();
    const scope = await resolveResourceScope(actor);
    const project = await Project.findOne({ $and: [projectReadFilter(scope), { _id: projectId }] }).select("budget");
    if (!project) return fail(404, "NOT_FOUND");
    const rows = await ProjectPayment.find({ projectId: project._id, status: "PAID" }).select("amount");
    const paidRows: { amountMinor: number; currency: string }[] = [];
    for (const row of rows) {
      const amountMinor = row.amount?.amountMinor;
      const currency = row.amount?.currency;
      if (typeof amountMinor !== "number" || typeof currency !== "string") continue;
      paidRows.push({ amountMinor, currency });
    }
    if (paidRows.length !== rows.length) {
      const summary: FinancialCalculation = { availability: "unavailable", basis: "recorded_paid_rows", currency: "LKR", reason: "unsafe_amount" };
      return { ok: true as const, summary, calculatedAt: new Date().toISOString() };
    }
    const summary = summarizeRecordedPayments(project.budget?.amountMinor, paidRows);
    return { ok: true as const, summary, calculatedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof FlowControl) return fail(error.status, error.code);
    throw new FinancialProgressDependencyError();
  }
}
