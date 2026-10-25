import { z } from "zod";

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

const personName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => !hasControlChar(value), "name contains control characters");

export const profilePatchSchema = z
  .object({
    firstName: personName,
    lastName: personName,
    revision: z.number().int().min(0),
  })
  .strict();

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
