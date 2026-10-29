import { z } from "zod";

const safeNote = z.string().trim().min(1).max(2000).refine((value) => {
  if (value.includes("$")) return false;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return false;
  }
  return true;
});

export const progressSubmitSchema = z.object({
  percentage: z.number().int().min(0).max(100),
  note: safeNote,
  revision: z.number().int().nonnegative(),
}).strict();

export const progressHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export type ProgressSubmitInput = z.infer<typeof progressSubmitSchema>;
export type ProgressHistoryQuery = z.infer<typeof progressHistoryQuerySchema>;
