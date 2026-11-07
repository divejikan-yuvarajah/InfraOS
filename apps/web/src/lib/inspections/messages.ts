import type { AuthLocale } from "@/lib/auth/types";

import { en, type Copy } from "./messages-en";
import { si } from "./messages-si";
import { ta } from "./messages-ta";

export type { Copy };
export const INSPECTION_COPY: Record<AuthLocale, Copy> = { en, si, ta };
export const getInspectionCopy = (locale: AuthLocale): Copy => INSPECTION_COPY[locale] ?? en;

/** Every dotted key path of a copy tree, used to prove the three dictionaries stay identical. */
export function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}
