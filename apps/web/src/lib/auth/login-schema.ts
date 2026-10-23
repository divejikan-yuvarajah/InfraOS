import { z } from "zod";

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.input<typeof loginFormSchema>;
export type ParsedLoginFormValues = z.output<typeof loginFormSchema>;
