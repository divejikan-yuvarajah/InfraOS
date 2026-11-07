import { Router } from "express";

import { healthRouter, readyRouter } from "../modules/health/health.routes.js";
import { authRouter } from "../modules/identity/auth/auth.routes.js";
import { emailVerificationRouter } from "../modules/identity/email-verification.routes.js";
import { agencyManagementRouter } from "../modules/agencies/management/agency-management.routes.js";
import { adminPermissionRouter, adminRoleRouter } from "../modules/identity/admin-roles/admin-role.routes.js";
import { adminUserRouter } from "../modules/identity/admin-users/admin-user.routes.js";
import { profileRouter } from "../modules/identity/profile/profile.routes.js";
import { projectRouter } from "../modules/projects/projects.routes.js";
import { notificationRouter } from "../modules/notifications/notice.routes.js";
import { roadsyncRouter } from "../modules/roadsync/work-requests.routes.js";
import { projectContractorRouter } from "../modules/contractors/contractor-assignment.routes.js";
import { contractorRouter } from "../modules/contractors/contractor.routes.js";
import { inframapRouter } from "../modules/inframap/inframap.routes.js";

export function createV1Router(): Router {
  const router = Router();
  router.use("/health", healthRouter);
  router.use("/ready", readyRouter);
  router.use("/auth", emailVerificationRouter);
  router.use("/auth", authRouter);
  router.use("/profile", profileRouter);
  router.use("/admin/users", adminUserRouter);
  router.use("/admin/agencies", agencyManagementRouter);
  router.use("/admin/roles", adminRoleRouter);
  router.use("/admin/permissions", adminPermissionRouter);
  router.use("/projects/:projectId/contractors", projectContractorRouter);
  router.use("/projects", projectRouter);
  router.use("/notifications", notificationRouter);
  router.use("/roadsync", roadsyncRouter);
  router.use("/inframap", inframapRouter);
  router.use("/contractors", contractorRouter);
  return router;
}
