import express from "express";

import { requestIdMiddleware } from "../../src/middleware/request-id.js";
import { requireAuthenticated } from "../../src/modules/identity/auth/require-authenticated.js";
import { requirePermission } from "../../src/modules/identity/authorization/require-permission.js";
import {
  approvePayment,
  listProjects,
  readConflict,
  readDocument,
  readInspection,
  readNotification,
  readProject,
  updateProjectTitle,
  type AccessFailure,
  type AccessSuccess,
} from "../../src/modules/identity/authorization/resource-scope.js";
import { failure, success } from "../../src/shared/http/envelope.js";

/**
 * Test-only scope routes. They are not mounted on /api/v1.
 */
function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function send<T>(res: express.Response, req: express.Request, result: AccessSuccess<T> | AccessFailure): void {
  res.setHeader("Cache-Control", "no-store");
  if (!result.ok) {
    const message =
      result.status === 400
        ? "request could not be completed"
        : result.status === 403
          ? "request could not be completed"
          : result.status === 409
            ? "request could not be completed"
            : result.status === 503
              ? "sign-in is temporarily unavailable"
              : "resource was not found";
    res.status(result.status).json(failure(result.code, message, req.requestId));
    return;
  }
  res.status(200).json(success(result.data, req.requestId));
}

export function createScopeHarness(): express.Express {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "20kb" }));
  app.get("/harness/projects", requireAuthenticated, requirePermission("project.read"), async (req, res) => {
    if (!req.actor) return;
    send(res, req, await listProjects(req.actor, req.query));
  });
  app.get("/harness/projects/:id", requireAuthenticated, requirePermission("project.read"), async (req, res) => {
    if (!req.actor) return;
    send(res, req, await readProject(req.actor, param(req.params.id)));
  });
  app.patch("/harness/projects/:id", requireAuthenticated, requirePermission("project.update"), async (req, res) => {
    if (!req.actor) return;
    const title = req.body && typeof req.body === "object" ? (req.body as { title?: unknown }).title : undefined;
    send(res, req, await updateProjectTitle(req.actor, param(req.params.id), typeof title === "string" ? title : ""));
  });
  app.get("/harness/documents/:id", requireAuthenticated, requirePermission("document.read"), async (req, res) => {
    if (!req.actor) return;
    send(res, req, await readDocument(req.actor, param(req.params.id)));
  });
  app.get("/harness/notifications/:id", requireAuthenticated, requirePermission("notification.read"), async (req, res) => {
    if (!req.actor) return;
    send(res, req, await readNotification(req.actor, param(req.params.id)));
  });
  app.get("/harness/inspections/:id", requireAuthenticated, requirePermission("inspection.read"), async (req, res) => {
    if (!req.actor) return;
    send(res, req, await readInspection(req.actor, param(req.params.id)));
  });
  app.get("/harness/conflicts/:id", requireAuthenticated, requirePermission("roadsync.conflict.read"), async (req, res) => {
    if (!req.actor) return;
    send(res, req, await readConflict(req.actor, param(req.params.id)));
  });
  app.post("/harness/payments/:id/approve", requireAuthenticated, requirePermission("finance.payment.approve"), async (req, res) => {
    if (!req.actor) return;
    send(res, req, await approvePayment(req.actor, param(req.params.id)));
  });
  return app;
}
