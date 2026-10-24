import { z } from "zod";

export const forgotPasswordBodySchema = z
  .object({
    email: z.string().trim().max(254).email().transform((value) => value.toLowerCase()),
  })
  .strict();

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
