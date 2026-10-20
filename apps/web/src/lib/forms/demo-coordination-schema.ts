import { z } from "zod";

import { isDateOnlyString } from "@/lib/design/date-only";
import { parseLkrToMinorUnits, trimToUndefined } from "@/lib/forms/normalizers";

export const DEMO_AGENCIES = [
  { id: "agency-alpha", label: "Synthetic Agency Alpha" },
  { id: "agency-beta", label: "Synthetic Agency Beta" },
] as const;

export const DEMO_CATEGORIES = ["ROAD", "WATER"] as const;

const optionalAmount = z
  .string()
  .optional()
  .transform((value, ctx) => {
    try {
      return parseLkrToMinorUnits(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid amount",
      });
      return z.NEVER;
    }
  });

export const demoCoordinationFormSchema = z
  .object({
    title: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(3, "Enter at least 3 characters.").max(120, "Use 120 characters or fewer.")),
    agencyId: z.string().min(1, "Select an agency."),
    category: z.enum(DEMO_CATEGORIES, { message: "Select a category." }),
    startDate: z.string().refine(isDateOnlyString, "Choose a valid start date."),
    endDate: z.string().refine(isDateOnlyString, "Choose a valid end date."),
    amountLkr: optionalAmount,
    notes: z
      .string()
      .optional()
      .transform((value) => trimToUndefined(value)),
  })
  .superRefine((value, ctx) => {
    if (value.notes && value.notes.length > 500) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Notes must be 500 characters or fewer.",
      });
    }
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

export type DemoFormInput = z.input<typeof demoCoordinationFormSchema>;
export type DemoFormOutput = z.output<typeof demoCoordinationFormSchema>;

export const DEMO_FORM_PATHS = [
  "title",
  "agencyId",
  "category",
  "startDate",
  "endDate",
  "amountLkr",
  "notes",
] as const;

export const demoFormDefaults: DemoFormInput = {
  title: "",
  agencyId: "",
  category: "ROAD",
  startDate: "",
  endDate: "",
  amountLkr: "",
  notes: "",
};
