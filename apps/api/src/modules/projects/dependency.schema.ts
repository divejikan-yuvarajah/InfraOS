import { z } from "zod";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

export const dependencyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(20),
}).strict();

export const dependencyCandidateQuerySchema = z.object({
  q: z.string().trim().max(40).default(""),
}).strict();

export const dependencyCreateSchema = z.object({
  prerequisiteProjectId: objectId,
  graphRevision: z.number().int().min(0),
}).strict();

export const dependencyRemoveSchema = z.object({
  graphRevision: z.number().int().min(0),
}).strict();

export const DEPENDENCY_LIST_KEYS = ["page", "limit"] as const;
export const DEPENDENCY_CANDIDATE_KEYS = ["q"] as const;

export type DependencyListQuery = z.infer<typeof dependencyListQuerySchema>;
export type DependencyCandidateQuery = z.infer<typeof dependencyCandidateQuerySchema>;
export type DependencyCreateBody = z.infer<typeof dependencyCreateSchema>;
export type DependencyRemoveBody = z.infer<typeof dependencyRemoveSchema>;
