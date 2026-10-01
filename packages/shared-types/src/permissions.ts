/**
 * Locked Step 4 permission catalog (`resource.action`).
 * Must stay aligned with docs/security/permission-catalog.md.
 * Unknown names are rejected on Role documents.
 */
export const PERMISSION_CATALOG = [
  "profile.read",
  "profile.update",
  "user.read",
  "user.create",
  "user.update",
  "user.disable",
  "agency.read",
  "agency.manage",
  "role.read",
  "role.manage",
  "permission.read",
  "permission.manage",
  "system.read",
  "system.manage",
  "audit.read",
  "audit.export",
  "project.create",
  "project.read",
  "project.update",
  "project.delete",
  "project.submit",
  "project.approve",
  "project.hold",
  "project.cancel",
  "project.complete",
  "project.dashboard.read",
  "project.timeline.read",
  "milestone.create",
  "milestone.read",
  "milestone.update",
  "milestone.delete",
  "progress.read",
  "progress.submit",
  "roadsync.work_request.create",
  "roadsync.work_request.read",
  "roadsync.work_request.update",
  "roadsync.work_request.cancel",
  "roadsync.conflict.read",
  "roadsync.conflict.recalculate",
  "roadsync.coordination.create",
  "roadsync.coordination.respond",
  "roadsync.coordination.read",
  "roadsync.conflict.resolve",
  "map.view.public",
  "map.view.internal",
  "map.layer.restricted",
  "risk.request",
  "risk.read",
  "document.upload",
  "document.read",
  "document.download",
  "document.delete",
  "document.process",
  "document.ask",
  "contractor.read",
  "contractor.manage",
  "contractor.performance.read",
  "finance.budget.read",
  "finance.budget.update",
  "finance.payment.create",
  "finance.payment.read",
  "finance.payment.update",
  "finance.payment.approve",
  "finance.payment.reject",
  "finance.report.export",
  "inspection.assign",
  "inspection.read",
  "inspection.submit",
  "inspection.verify",
  "inspection.reject",
  "asset.read",
  "asset.create",
  "asset.update",
  "maintenance.create",
  "maintenance.update",
  "asset.health.read",
  "citizen_issue.create",
  "citizen_issue.read",
  "citizen_issue.assign",
  "citizen_issue.update",
  "citizen_issue.close",
  "notification.read",
  "notification.update",
  "notification.preference.update",
  "report.view",
  "report.export",
] as const;

export type Permission = (typeof PERMISSION_CATALOG)[number];

export const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSION_CATALOG);

const PERMISSION_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

export function isPermissionFormat(value: string): boolean {
  return PERMISSION_PATTERN.test(value);
}
