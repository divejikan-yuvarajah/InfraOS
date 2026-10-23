import { Router } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { logger } from "../../../shared/logger.js";
import { AuthDependencyError } from "./auth.errors.js";
import {
  isJsonContentType,
  loginRateLimit,
  refreshRateLimit,
  rejectDisallowedOrigin,
} from "./auth.security.js";
import { loginWithPassword } from "./auth.service.js";
import { authNow } from "./auth.clock.js";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./cookies.js";
import { loginBodySchema } from "./login.schema.js";
import { rotateRefreshSession } from "./refresh-session.service.js";

function noStore(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

export const authRouter = Router();

authRouter.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    noStore(res);
    if (rejectDisallowedOrigin(req, res)) return;
    if (!isJsonContentType(req)) {
      res
        .status(415)
        .json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json(failure("VALIDATION_ERROR", "sign-in could not be completed", req.requestId));
      return;
    }
    const issued = await loginWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      userAgent: req.header("user-agent"),
      requestId: req.requestId,
    });
    if (!issued) {
      res
        .status(401)
        .json(failure("AUTH_REQUIRED", "sign-in could not be completed", req.requestId));
      return;
    }
    setRefreshCookie(res, issued.refreshToken, issued.refreshExpiresAt, authNow());
    res.status(200).json(success(issued.session, req.requestId));
  } catch (error) {
    if (error instanceof AuthDependencyError) {
      res.status(503).json(failure(error.code, error.message, req.requestId));
      return;
    }
    next(error);
  }
});

authRouter.post("/refresh", refreshRateLimit, async (req, res, next) => {
  try {
    noStore(res);
    if (rejectDisallowedOrigin(req, res)) return;
    const contentType = req.header("content-type");
    if (contentType && !isJsonContentType(req)) {
      clearRefreshCookie(res);
      res
        .status(415)
        .json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      clearRefreshCookie(res);
      res
        .status(401)
        .json(failure("SESSION_EXPIRED", "sign-in could not be completed", req.requestId));
      return;
    }
    const rotated = await rotateRefreshSession({
      refreshToken,
      userAgent: req.header("user-agent"),
    });
    if (!rotated.ok) {
      clearRefreshCookie(res);
      const status = rotated.reason === "unavailable" ? 503 : 401;
      const code = rotated.reason === "unavailable" ? "SERVICE_UNAVAILABLE" : "SESSION_EXPIRED";
      res.status(status).json(failure(code, "sign-in could not be completed", req.requestId));
      return;
    }
    setRefreshCookie(
      res,
      rotated.issued.refreshToken,
      rotated.issued.refreshExpiresAt,
      authNow(),
    );
    logger.info(
      { requestId: req.requestId, outcome: "refreshed", userId: rotated.issued.session.user.id },
      "refresh accepted",
    );
    res.status(200).json(success(rotated.issued.session, req.requestId));
  } catch (error) {
    if (error instanceof AuthDependencyError) {
      clearRefreshCookie(res);
      res.status(503).json(failure(error.code, error.message, req.requestId));
      return;
    }
    next(error);
  }
});
