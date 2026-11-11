import type { AuthLocale } from "@/lib/auth/types";

import { INSPECTION_AI_EN, type InspectionAiMessages } from "./messages-en";
import { INSPECTION_AI_SI } from "./messages-si";
import { INSPECTION_AI_TA } from "./messages-ta";

export type { InspectionAiMessages };
export const INSPECTION_AI_COPY: Record<AuthLocale, InspectionAiMessages> = {
  en: INSPECTION_AI_EN,
  si: INSPECTION_AI_SI,
  ta: INSPECTION_AI_TA,
};

export const getInspectionAiCopy = (locale: AuthLocale): InspectionAiMessages =>
  INSPECTION_AI_COPY[locale] ?? INSPECTION_AI_EN;

