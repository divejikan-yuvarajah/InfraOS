import { Router } from "express";

import { failure, success } from "../../../shared/http/envelope.js";
import { logger } from "../../../shared/logger.js";
import { AuthDependencyError } from "./auth.errors.js";
import { assertAuthInfrastructure } from "./jwt.js";
import { env } from "../../../config/env.js";
import { requestPasswordReset, PasswordResetDependencyError } from "../password-reset-request.service.js";
import { forgotPasswordBodySchema } from "../password-reset-request.schema.js";
import { consumePasswordReset } from "../password-reset-consume.service.js";
import { resetPasswordBodySchema } from "../password-reset-consume.schema.js";
import { createPasswordResetSender } from "../password-reset-mail.js";
import {
  forgotPasswordRateLimit,
  resetPasswordRateLimit,
  isJsonContentType,
  loginRateLimit,
  logoutRateLimit,
  refreshRateLimit,
  rejectDisallowedOrigin,
} from "./auth.security.js";
import { loginWithPassword } from "./auth.service.js";
import { authNow } from "./auth.clock.js";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./cookies.js";
import { loginBodySchema } from "./login.schema.js";
import { logoutRefreshFamily, rotateRefreshSession } from "./refresh-session.service.js";
import { requireAuthenticated } from "./require-authenticated.js";

function noStore(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

const passwordResetSender = createPasswordResetSender(env.NODE_ENV);

export const authRouter = Router();

authRouter.get("/me", requireAuthenticated, (req, res) => {
  noStore(res);
  res.status(200).json(success({ user: req.authUser }, req.requestId));
});

authRouter.post("/forgot-password", forgotPasswordRateLimit, async (req, res, next) => {
  try {
    noStore(res);
    res.setHeader("Referrer-Policy", "no-referrer");
    if (rejectDisallowedOrigin(req, res)) return;
    if (!isJsonContentType(req)) {
      res
        .status(415)
        .json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const body = req.body ?? {};
    if (typeof body === "object" && body !== null && ("returnTo" in body || "next" in body)) {
      res
        .status(400)
        .json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const parsed = forgotPasswordBodySchema.safeParse(body);
    if (!parsed.success) {
      res
        .status(400)
        .json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    await requestPasswordReset({
      email: parsed.data.email,
      sender: passwordResetSender,
      allowlistedOrigin: env.FRONTEND_ORIGIN,
      requestId: req.requestId,
    });
    res.status(200).json(success({ status: "ACCEPTED" }, req.requestId));
  } catch (error) {
    if (error instanceof PasswordResetDependencyError) {
      res.status(503).json(failure(error.code, error.message, req.requestId));
      return;
    }
    next(error);
  }
});

authRouter.post("/reset-password", resetPasswordRateLimit, async (req, res, next) => {
  try {
    noStore(res);
    res.setHeader("Referrer-Policy", "no-referrer");
    if (rejectDisallowedOrigin(req, res)) return;
    if (!isJsonContentType(req)) {
      res
        .status(415)
        .json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    const body = req.body ?? {};
    if (typeof body === "object" && body !== null && ("returnTo" in body || "next" in body)) {
      res
        .status(400)
        .json(failure("VALIDATION_ERROR", "password reset could not be completed", req.requestId));
      return;
    }
    const parsed = resetPasswordBodySchema.safeParse(body);
    if (!parsed.success) {
      res
        .status(400)
        .json(failure("VALIDATION_ERROR", "password reset could not be completed", req.requestId));
      return;
    }
    const result = await consumePasswordReset({
      token: parsed.data.token,
      password: parsed.data.password,
    });
    if (!result.ok) {
      const status = result.reason === "unavailable" ? 503 : 400;
      const code = result.reason === "unavailable" ? "SERVICE_UNAVAILABLE" : "VALIDATION_ERROR";
      res
        .status(status)
        .json(failure(code, "password reset could not be completed", req.requestId));
      return;
    }
    res.status(200).json(success({ status: "RESET" }, req.requestId));
  } catch (error) {
    next(error);
  }
});

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
    assertAuthInfrastructure();
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

authRouter.post("/logout", logoutRateLimit, async (req, res, next) => {
  try {
    noStore(res);
    if (rejectDisallowedOrigin(req, res)) return;
    const contentType = req.header("content-type");
    if (contentType && !isJsonContentType(req)) {
      res
        .status(415)
        .json(failure("UNSUPPORTED_MEDIA", "JSON body is required", req.requestId));
      return;
    }
    assertAuthInfrastructure();
    const result = await logoutRefreshFamily(readRefreshCookie(req));
    if (result === "unavailable") {
      res
        .status(503)
        .json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    clearRefreshCookie(res);
    logger.info({ requestId: req.requestId, outcome: result }, "logout accepted");
    res.status(204).end();
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
    assertAuthInfrastructure();
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
