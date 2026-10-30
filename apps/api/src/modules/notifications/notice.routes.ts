import { Router } from "express";

import { failure, success } from "../../shared/http/envelope.js";
import { requireAuthenticated } from "../identity/auth/require-authenticated.js";
import { requirePermission } from "../identity/authorization/require-permission.js";
import { NOTICE_LIST_KEYS, noticeListQuerySchema } from "./notice.schema.js";
import { NoticeDependencyError, listNotices, setNoticeRead, unreadNoticeCount } from "./notice.service.js";
import type { NoticeFailure } from "./notice.service.js";

function noStore(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function sendFailure(res: { status: (code: number) => { json: (body: unknown) => void } }, req: { requestId: string }, result: NoticeFailure): void {
  const message = result.status === 503
    ? "sign-in is temporarily unavailable"
    : result.status === 401
      ? "sign-in is required"
      : result.status === 404
        ? "resource was not found"
        : "request could not be completed";
  res.status(result.status).json(failure(result.code, message, req.requestId));
}

function routeId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const notificationRouter = Router();

notificationRouter.get("/unread-count", requireAuthenticated, requirePermission("notification.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    if (Object.keys(req.query).length > 0) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await unreadNoticeCount(actor);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success({ count: result.count }, req.requestId));
  } catch (error) {
    if (error instanceof NoticeDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

notificationRouter.get("/", requireAuthenticated, requirePermission("notification.read"), async (req, res) => {
  try {
    noStore(res);
    const actor = req.actor;
    if (!actor) return;
    const repeated = Object.values(req.query).some((value) => Array.isArray(value));
    const unknown = Object.keys(req.query).filter((key) => !NOTICE_LIST_KEYS.includes(key as (typeof NOTICE_LIST_KEYS)[number]));
    if (unknown.length > 0 || repeated) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const parsed = noticeListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(failure("VALIDATION_ERROR", "request could not be completed", req.requestId));
      return;
    }
    const result = await listNotices(actor, parsed.data);
    if (!result.ok) {
      sendFailure(res, req, result);
      return;
    }
    res.status(200).json(success(result.list, req.requestId));
  } catch (error) {
    if (error instanceof NoticeDependencyError) {
      res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
      return;
    }
    throw error;
  }
});

function mark(isRead: boolean) {
  return async (req: { actor?: Parameters<typeof setNoticeRead>[0]; params: { id?: string | string[] }; requestId: string }, res: { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void }): Promise<void> => {
    try {
      noStore(res);
      const actor = req.actor;
      if (!actor) return;
      const result = await setNoticeRead(actor, routeId(req.params.id), isRead);
      if (!result.ok) {
        sendFailure(res, req, result);
        return;
      }
      res.status(200).json(success(result.notice, req.requestId));
    } catch (error) {
      if (error instanceof NoticeDependencyError) {
        res.status(503).json(failure("SERVICE_UNAVAILABLE", "sign-in is temporarily unavailable", req.requestId));
        return;
      }
      throw error;
    }
  };
}

notificationRouter.patch("/:id/read", requireAuthenticated, requirePermission("notification.update"), mark(true));
notificationRouter.patch("/:id/unread", requireAuthenticated, requirePermission("notification.update"), mark(false));
