import type { AuthLocale } from "@/lib/auth/types";

import { en, type AiCopy } from "./messages-en";
import { si } from "./messages-si";
import { ta } from "./messages-ta";

export type { AiCopy };
export const AI_COPY: Record<AuthLocale, AiCopy> = { en, si, ta };
export const getAiCopy = (locale: AuthLocale): AiCopy => AI_COPY[locale] ?? en;
