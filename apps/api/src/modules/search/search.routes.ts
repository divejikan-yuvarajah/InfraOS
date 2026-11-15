import { Router } from "express";

import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { runGlobalSearch } from "./search.service.js";

export const searchRouter = Router();

searchRouter.get("/", requireAuthenticated, async (req, res) => {
  const actor = req.actor;
  if (!actor) return;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2 || q.length > 100) {
    res.status(400).json(failure("VALIDATION_ERROR", "query q must be 2 to 100 characters", req.requestId));
    return;
  }
  const limitRaw = Number(req.query.limit ?? 5);
  const limit = Number.isFinite(limitRaw) ? Math.min(20, Math.max(1, Math.floor(limitRaw))) : 5;
  const data = await runGlobalSearch(actor, q, limit);
  res.status(200).json(success(data, req.requestId));
});
