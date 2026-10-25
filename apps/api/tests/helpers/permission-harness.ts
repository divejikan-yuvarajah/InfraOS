import express from "express";
import type { Permission } from "@infraos/shared-types";

import { requestIdMiddleware } from "../../src/middleware/request-id.js";
import { requirePermission } from "../../src/modules/identity/authorization/require-permission.js";
import { requireAuthenticated } from "../../src/modules/identity/auth/require-authenticated.js";
import { success } from "../../src/shared/http/envelope.js";

/**
 * Test-only app. These paths are not mounted on /api/v1.
 * Each guarded route is requireAuthenticated, then requirePermission.
 */
const GUARDED: Array<{ path: string; permission: Permission }> = [
  { path: "/harness/project-read", permission: "project.read" },
  { path: "/harness/project-approve", permission: "project.approve" },
  { path: "/harness/payment-approve", permission: "finance.payment.approve" },
  { path: "/harness/inspection-verify", permission: "inspection.verify" },
  { path: "/harness/conflict-resolve", permission: "roadsync.conflict.resolve" },
];

export function createPermissionHarness(): express.Express {
  const app = express();
  app.use(requestIdMiddleware);
  for (const route of GUARDED) {
    app.get(
      route.path,
      requireAuthenticated,
      requirePermission(route.permission),
      (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json(success({ allowed: true }, req.requestId));
      },
    );
  }
  app.get("/harness/permission-only", requirePermission("project.read"), (req, res) => {
    res.status(200).json(success({ allowed: true }, req.requestId));
  });
  return app;
}
