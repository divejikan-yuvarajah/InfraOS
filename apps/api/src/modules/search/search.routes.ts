import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../../config/env.js";
import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { runGlobalSearch } from "./search.service.js";

export const searchRouter = Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10_000 : 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(failure("RATE_LIMITED", "Search rate limit exceeded", req.requestId));
  },
});

searchRouter.get("/", searchLimiter, requireAuthenticated, async (req, res) => {
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
