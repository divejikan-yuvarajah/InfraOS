import type { LucideIcon } from "lucide-react";
import {
  BellIcon,
  Building2Icon,
  ClipboardCheckIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type WorkspaceNavGroup = { label: string; items: readonly WorkspaceNavItem[] };

/** Only routes that exist today. Visibility rules are unchanged; the server enforces access. */
export const WORKSPACE_NAV: readonly WorkspaceNavGroup[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon }] },
  {
    label: "Operations",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanbanIcon },
      { href: "/projects/reviews", label: "Reviews", icon: ClipboardCheckIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/notifications", label: "Notifications", icon: BellIcon },
      { href: "/admin/users", label: "Staff", icon: UsersIcon },
      { href: "/admin/agencies", label: "Agencies", icon: Building2Icon },
      { href: "/admin/roles", label: "Roles", icon: ShieldCheckIcon },
      { href: "/profile", label: "Profile", icon: UserCircleIcon },
      { href: "/settings", label: "Settings", icon: SlidersHorizontalIcon },
    ],
  },
];

export function navCurrent(pathname: string, href: string): boolean {
  const reviews = pathname === "/projects/reviews" || /^\/projects\/[^/]+\/review$/.test(pathname);
  if (href === "/projects/reviews") return reviews;
  if (href === "/projects") return !reviews && (pathname === href || pathname.startsWith(`${href}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrator",
  GOV_ADMIN: "Government Administrator",
  AGENCY_OFFICER: "Agency Officer",
  PROJECT_MANAGER: "Project Manager",
  CONTRACTOR: "Contractor",
  INSPECTOR: "Inspector",
  CITIZEN: "Citizen",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const picked = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  const letters = picked.map((p) => (p ? (Array.from(p)[0] ?? "") : "")).join("");
  return letters.toUpperCase() || "?";
}
