import { Router } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { requirePermission } from "../authorization/require-permission.js";
import { requireAuthenticated } from "../auth/require-authenticated.js";
import { isJsonContentType } from "../auth/auth.security.js";
import { profilePatchSchema } from "./profile.schema.js";
import { ProfileDependencyError, getSelfProfile, updateSelfProfile } from "./profile.service.js";

function noStore(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

export const profileRouter = Router();

profileRouter.get("/me", requireAuthenticated, requirePermission("profile.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const result = await getSelfProfile(actor);
    if (!result.ok) {
      res.status(result.status).json(failure(result.code, "resource was not found", req.requestId));
      return;
    }
    res.status(200).json(success({ profile: result.profile }, req.requestId));
  } catch (error) {
    if (error instanceof ProfileDependencyError) {
      res
        .status(503)
        .json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

profileRouter.patch("/me", requireAuthenticated, requirePermission("profile.update"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (!isJsonContentType(req)) {
      res
        .status(415)
        .json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = profilePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await updateSelfProfile(actor, parsed.data);
    if (!result.ok) {
      const message =
        result.status === 409 ? "request could not be completed" : "resource was not found";
      res.status(result.status).json(failure(result.code, message, req.requestId));
      return;
    }
    res.status(200).json(success({ profile: result.profile }, req.requestId));
  } catch (error) {
    if (error instanceof ProfileDependencyError) {
      res
        .status(503)
        .json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});
