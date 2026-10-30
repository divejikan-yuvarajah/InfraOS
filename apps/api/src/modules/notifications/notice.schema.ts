import { z } from "zod";

import { decodeNoticeCursor } from "./notice.policy.js";

export const noticeListQuerySchema = z.object({
  state: z.enum(["all", "read", "unread"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(240).optional().refine((value) => value === undefined || decodeNoticeCursor(value) !== null),
}).strict();

export type NoticeListQuery = z.infer<typeof noticeListQuerySchema>;

export const NOTICE_LIST_KEYS = ["state", "limit", "cursor"] as const;
