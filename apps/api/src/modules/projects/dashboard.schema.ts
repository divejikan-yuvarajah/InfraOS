import { z } from "zod";

export const dashboardQuerySchema = z.object({}).strict();

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
