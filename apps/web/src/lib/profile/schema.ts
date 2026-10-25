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
  .min(1, "Enter a name")
  .max(80, "Name is too long")
  .refine((value) => !hasControlChar(value), "Name contains invalid characters");

export const profileFormSchema = z.object({
  firstName: personName,
  lastName: personName,
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
