import type { AuthLocale } from "@/lib/auth/types";

import { en, type RagCopy } from "./rag-messages-en";
import { si } from "./rag-messages-si";
import { ta } from "./rag-messages-ta";

export type { RagCopy };
export const RAG_COPY: Record<AuthLocale, RagCopy> = { en, si, ta };
export const getRagCopy = (locale: AuthLocale): RagCopy => RAG_COPY[locale] ?? en;
