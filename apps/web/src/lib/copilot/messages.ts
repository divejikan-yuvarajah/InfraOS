import type { AuthLocale } from "@/lib/auth/types";

import { COPILOT_EN, type CopilotMessages } from "./messages-en";
import { COPILOT_SI } from "./messages-si";
import { COPILOT_TA } from "./messages-ta";

export type { CopilotMessages };
export const COPILOT_COPY: Record<AuthLocale, CopilotMessages> = {
  en: COPILOT_EN,
  si: COPILOT_SI,
  ta: COPILOT_TA,
};

export const getCopilotCopy = (locale: AuthLocale): CopilotMessages => COPILOT_COPY[locale] ?? COPILOT_EN;

