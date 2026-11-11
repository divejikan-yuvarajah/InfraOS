import { Router, type Request } from "express";
import { z } from "zod";
import { success, failure } from "../../../shared/http/envelope.js";
import { requireAuthenticated } from "../../identity/auth/require-authenticated.js";
import { requirePermission } from "../../identity/authorization/require-permission.js";
import { Role } from "../../identity/models/role.model.js";
import {
  createCopilotTurn,
  getCopilotTurn,
  getCopilotThread,
  submitCopilotFeedback,
  cancelCopilotTurn,
  listCopilotThreads,
  deleteCopilotThread,
  CopilotError,
} from "./copilot-turn.service.js";
import { getQuickFacts } from "./quick-facts.service.js";
import { getSuggestions } from "./copilot-suggestions.service.js";
import {
  AI_FEEDBACK_RATINGS,
  AI_FEEDBACK_REASONS,
  COPILOT_PAGE_TYPES,
} from "@infraos/shared-types";
import type { AuthenticatedActor } from "./copilot.types.js";

export const copilotRouter = Router();

const auth = [requireAuthenticated, requirePermission("copilot.use")];

async function resolveActor(req: Request): Promise<AuthenticatedActor> {
  const rawActor = req.actor!;
  let permissions: string[] = [];
  if (rawActor.roleId) {
    const role = await Role.findById(rawActor.roleId).select("permissions").lean();
    if (role && Array.isArray(role.permissions)) {
      permissions = role.permissions;
    }
  }
  return {
    userId: rawActor.userId,
    agencyId: rawActor.agencyId,
    roleId: rawActor.roleId,
    roleKey: rawActor.roleKey,
    credentialEpoch: rawActor.credentialEpoch,
    permissions,
  };
}

const createTurnSchema = z.object({
  message: z.string().min(1).max(800),
  threadId: z.string().optional(),
  pageContext: z.object({
    type: z.enum(COPILOT_PAGE_TYPES),
    recordId: z.string().optional(),
    route: z.string().max(300),
  }).optional(),
}).strict();

const feedbackSchema = z.object({
  rating: z.enum(AI_FEEDBACK_RATINGS),
  reason: z.enum(AI_FEEDBACK_REASONS).optional(),
  comment: z.string().trim().max(300).optional(),
}).strict();

// POST /api/v1/ai/copilot/turns
copilotRouter.post("/turns", ...auth, async (req, res) => {
  const parsed = createTurnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid payload", req.requestId));
    return;
  }

  try {
    const actor = await resolveActor(req);
    const result = await createCopilotTurn(actor, parsed.data, req.requestId);

    // Return 202 Accepted per §4.3
    res.status(202).json(success(result, req.requestId));
  } catch (err: unknown) {
    if (err instanceof CopilotError) {
      res.status(err.statusCode).json(failure(err.code, err.details?.message ? String(err.details.message) : err.code, req.requestId, err.details));
      return;
    }
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to start copilot turn", req.requestId));
  }
});

// GET /api/v1/ai/copilot/turns/:id
copilotRouter.get("/turns/:id", ...auth, async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const turn = await getCopilotTurn(actor, String(req.params.id));
    res.status(200).json(success(turn, req.requestId));
  } catch (err: unknown) {
    if (err instanceof CopilotError) {
      res.status(err.statusCode).json(failure(err.code, err.message, req.requestId));
      return;
    }
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to load copilot turn", req.requestId));
  }
});

// POST /api/v1/ai/copilot/turns/:id/cancel
copilotRouter.post("/turns/:id/cancel", ...auth, async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const result = await cancelCopilotTurn(actor, String(req.params.id));
    res.status(200).json(success(result, req.requestId));
  } catch (err: unknown) {
    if (err instanceof CopilotError) {
      res.status(err.statusCode).json(failure(err.code, err.message, req.requestId));
      return;
    }
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to cancel turn", req.requestId));
  }
});

// POST /api/v1/ai/copilot/turns/:id/feedback
copilotRouter.post("/turns/:id/feedback", ...auth, async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid feedback", req.requestId));
    return;
  }

  try {
    const actor = await resolveActor(req);
    const result = await submitCopilotFeedback(actor, String(req.params.id), parsed.data, req.requestId);
    res.status(200).json(success(result, req.requestId));
  } catch (err: unknown) {
    if (err instanceof CopilotError) {
      res.status(err.statusCode).json(failure(err.code, err.message, req.requestId));
      return;
    }
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to save feedback", req.requestId));
  }
});

// GET /api/v1/ai/copilot/quick-facts
copilotRouter.get("/quick-facts", ...auth, async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const facts = await getQuickFacts(actor, projectId);
    res.status(200).json(success(facts, req.requestId));
  } catch {
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to load quick facts", req.requestId));
  }
});

// GET /api/v1/ai/copilot/suggestions
copilotRouter.get("/suggestions", ...auth, async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const pageType = typeof req.query.pageType === "string" ? req.query.pageType : undefined;
    const recordId = typeof req.query.recordId === "string" ? req.query.recordId : undefined;
    const suggestions = await getSuggestions(actor, pageType, recordId);
    res.status(200).json(success(suggestions, req.requestId));
  } catch {
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to load suggestions", req.requestId));
  }
});

// GET /api/v1/ai/copilot/threads
copilotRouter.get("/threads", ...auth, async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const result = await listCopilotThreads(actor);
    res.status(200).json(success(result, req.requestId));
  } catch {
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to list threads", req.requestId));
  }
});

// GET /api/v1/ai/copilot/threads/:threadId
copilotRouter.get("/threads/:threadId", ...auth, async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const result = await getCopilotThread(actor, String(req.params.threadId));
    res.status(200).json(success(result, req.requestId));
  } catch (err: unknown) {
    if (err instanceof CopilotError) {
      res.status(err.statusCode).json(failure(err.code, err.message, req.requestId));
      return;
    }
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to load thread", req.requestId));
  }
});

// DELETE /api/v1/ai/copilot/threads/:threadId
copilotRouter.delete("/threads/:threadId", ...auth, async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const result = await deleteCopilotThread(actor, String(req.params.threadId));
    res.status(200).json(success(result, req.requestId));
  } catch {
    res.status(500).json(failure("INTERNAL_ERROR", "Failed to delete thread", req.requestId));
  }
});
