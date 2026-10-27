import { z } from "zod";

import { buildProjectPatchBody, editBaselineFromProject, type EditBaseline, type ProjectEditFormValues } from "./edit-transform";
import type { ProjectDetail } from "./types";

export function projectEditFormSchema(baseline: EditBaseline) {
  return z
    .object({
      title: z.string(),
      description: z.string(),
      startDate: z.string(),
      plannedEndDate: z.string(),
      province: z.string(),
      district: z.string(),
      locality: z.string(),
      roadName: z.string(),
      locationDescription: z.string(),
      longitude: z.string(),
      latitude: z.string(),
      removeGeometry: z.boolean(),
    })
    .superRefine((value, ctx) => {
      const built = buildProjectPatchBody(value, baseline);
      if (built.ok) return;
      for (const [field, issue] of Object.entries(built.errors)) {
        ctx.addIssue({ code: "custom", path: [field], message: issue });
      }
    });
}

export type { ProjectEditFormValues };

export function editSchemaForProject(project: ProjectDetail) {
  return projectEditFormSchema(editBaselineFromProject(project));
}
