import type { AuthLocale } from "@/lib/auth/types";

import { AI_ADMIN_EN, type AiAdminCopy } from "./messages-en";
import { AI_ADMIN_SI } from "./messages-si";
import { AI_ADMIN_TA } from "./messages-ta";

export type { AiAdminCopy };
export const AI_ADMIN_COPY: Record<AuthLocale, AiAdminCopy> = {
  en: AI_ADMIN_EN,
  si: AI_ADMIN_SI,
  ta: AI_ADMIN_TA,
};

export const getAiAdminCopy = (locale: AuthLocale): AiAdminCopy => AI_ADMIN_COPY[locale] ?? AI_ADMIN_EN;

export function aiAdminKeyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => aiAdminKeyPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

