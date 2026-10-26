import { z } from "zod";

import { buildProjectCreateBody, type ProjectCreateFormValues } from "./create-transform";

export const projectCreateFormSchema = z
  .object({
    projectCode: z.string(),
    title: z.string(),
    projectType: z.string(),
    description: z.string(),
    startDate: z.string(),
    plannedEndDate: z.string(),
    amountLkr: z.string(),
    province: z.string(),
    district: z.string(),
    locality: z.string(),
    roadName: z.string(),
    locationDescription: z.string(),
    longitude: z.string(),
    latitude: z.string(),
  })
  .superRefine((value, ctx) => {
    const built = buildProjectCreateBody(value);
    if (built.ok) return;
    for (const [field, issue] of Object.entries(built.errors)) {
      ctx.addIssue({ code: "custom", path: [field], message: issue });
    }
  });

export type { ProjectCreateFormValues };
