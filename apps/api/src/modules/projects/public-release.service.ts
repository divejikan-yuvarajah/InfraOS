import mongoose from "mongoose";
import { z } from "zod";

import { AuditLog } from "../audit/models/audit-log.model.js";
import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import { projectReadFilter, resolveResourceScope } from "../identity/authorization/resource-scope.js";
import { Project } from "./models/project.model.js";

export const publicReleaseSchema = z.object({
  isPublic: z.boolean(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(120).optional(),
  showProgress: z.boolean().optional(),
  showBudgetBand: z.boolean().optional(),
  showCoordinates: z.boolean().optional(),
  safeTitle: z.string().trim().max(200).optional(),
  safeSummary: z.string().trim().max(2000).optional(),
});

export async function updateProjectPublicRelease(
  actor: AuthenticatedActor,
  projectId: string,
  input: z.infer<typeof publicReleaseSchema>,
  requestId: string,
) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  const scope = await resolveResourceScope(actor);
  const scopeFilter = projectReadFilter(scope);
  const project = await Project.findOne({ _id: new mongoose.Types.ObjectId(projectId), ...scopeFilter });
  if (!project) return null;

  const prevPublic = Boolean(project.publicRelease?.isPublic);
  const slug = input.slug ?? project.publicRelease?.slug ?? project.projectCode.toLowerCase();

  project.publicRelease = {
    isPublic: input.isPublic,
    slug,
    showProgress: input.showProgress ?? project.publicRelease?.showProgress ?? true,
    showBudgetBand: input.showBudgetBand ?? project.publicRelease?.showBudgetBand ?? false,
    showCoordinates: input.showCoordinates ?? project.publicRelease?.showCoordinates ?? true,
    safeTitle: input.safeTitle ?? project.publicRelease?.safeTitle ?? project.title,
    safeSummary: input.safeSummary ?? project.publicRelease?.safeSummary ?? project.description?.slice(0, 600),
    publishedAt: input.isPublic ? (project.publicRelease?.publishedAt ?? new Date()) : project.publicRelease?.publishedAt,
    publishedBy: new mongoose.Types.ObjectId(actor.userId),
  };

  await project.save();

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(actor.userId),
    agencyId: project.agencyId,
    action: input.isPublic ? "project.public_released" : "project.public_unpublished",
    resourceType: "PROJECT",
    resourceId: project._id,
    oldValue: { status: prevPublic ? "PUBLIC" : "PRIVATE" },
    newValue: { status: input.isPublic ? "PUBLIC" : "PRIVATE", reason: slug },
    requestId,
  });

  return project.publicRelease;
}
