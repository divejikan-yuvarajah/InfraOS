import { z } from "zod";

import { NOTIFICATION_TYPES } from "./notification.constants.js";
import { decodeNoticeCursor } from "./notice.policy.js";

export const noticeListQuerySchema = z.object({
  state: z.enum(["all", "read", "unread"]).default("all"),
  archived: z.enum(["active", "archived", "all"]).default("active"),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(240).optional().refine((value) => value === undefined || decodeNoticeCursor(value) !== null),
}).strict();

export type NoticeListQuery = z.infer<typeof noticeListQuerySchema>;

export const NOTICE_LIST_KEYS = ["state", "archived", "type", "severity", "limit", "cursor"] as const;
