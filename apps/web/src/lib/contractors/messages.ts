import type { AuthLocale } from "@/lib/auth/types";

import { en, type Copy } from "./messages-en";
import { si } from "./messages-si";
import { ta } from "./messages-ta";

export type { Copy };
export const CONTRACTOR_COPY: Record<AuthLocale, Copy> = { en, si, ta };
export const getContractorCopy = (locale: AuthLocale): Copy => CONTRACTOR_COPY[locale] ?? en;

/** Every dotted key path of a copy tree, used to prove the three dictionaries stay identical. */
export function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

/** Server error to a short, translated sentence. Never echoes the server text. */
export function failureMessage(status: number, kind: string | null, copy: Copy): string {
  if (status === 401) return copy.common.signedOut;
  if (status === 403) return copy.common.forbidden;
  if (status === 404) return copy.common.notFound;
  if (status === 409 && kind === "stale") return copy.form.stale.body;
  if (status === 409 && kind === "contractor_inactive") return copy.assign.inactive;
  if (status === 409 && kind === "project_state") return copy.assign.closedProject;
  if (status === 409 && kind === "primary_exists") return copy.assign.primaryExists;
  if (status === 409 && kind === "assignment_conflict") return copy.assign.duplicatePair;
  if (status === 409 && kind === "not_active") return copy.end.notActive;
  if (status === 409 && kind === "illegal_transition") return copy.statusDialog.illegal;
  if (status === 409 && kind === "active_assignments") return copy.statusDialog.archiveBlocked;
  if (status === 503) return copy.common.unavailable;
  return copy.common.errorGeneric;
}
