import { z } from "zod";

const baseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(60).optional(),
  category: z.string().trim().max(60).optional(),
  priority: z.string().trim().max(40).optional(),
  district: z.string().trim().max(80).optional(),
  agencyId: z.string().trim().max(64).optional(),
  sortBy: z.string().trim().max(40).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type ParsedListQuery = z.infer<typeof baseListQuerySchema> & {
  skip: number;
};

/** Shared list query parser for paginated inbox/directory endpoints. */
export function parseListQuery(raw: Record<string, unknown>): ParsedListQuery | null {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) return null;
    flat[k] = v;
  }
  const parsed = baseListQuerySchema.safeParse(flat);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    skip: (parsed.data.page - 1) * parsed.data.limit,
  };
}

/** Escape user search input before building case-insensitive regex filters. */
export function escapeSearchRegex(q: string): string {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
