import type { RoleCopy } from "./messages";

export const ADMIN_ROLES_QUERY_KEY = ["admin-roles"] as const;

export type RoleBanner = "forbidden" | "unavailable" | "conflict" | "saved" | null;

export function roleBannerMessage(banner: RoleBanner, copy: RoleCopy): string | null {
  if (banner === "forbidden") return copy.forbidden;
  if (banner === "unavailable") return copy.unavailable;
  if (banner === "conflict") return copy.conflict;
  if (banner === "saved") return copy.saved;
  return null;
}

export function bannerFromStatus(status: number): RoleBanner {
  if (status === 401 || status === 403) return "forbidden";
  if (status === 409) return "conflict";
  return "unavailable";
}

/** A missing draft stays on the saved grants. An empty array is sent only after an explicit edit. */
export function visibleRoleGrants(
  selected: { id: string; permissions: readonly string[] } | null,
  draft: { id: string; permissions: readonly string[] } | null,
): string[] {
  if (!selected) return [];
  if (draft?.id === selected.id) return [...draft.permissions];
  return [...selected.permissions];
}

/** Preview is the set the administrator asked to save. The API still decides. */
export function grantChangePreview(current: readonly string[], next: readonly string[]) {
  const now = new Set(current);
  const proposed = new Set(next);
  return {
    added: next.filter((permission) => !now.has(permission)),
    removed: current.filter((permission) => !proposed.has(permission)),
  };
}
