import { z } from "zod";

export const forgotPasswordFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(254)
    .transform((value) => value.toLowerCase()),
});

export type ForgotPasswordFormValues = z.input<typeof forgotPasswordFormSchema>;
