import type { LucideIcon } from "lucide-react";
import {
  BellIcon,
  Building2Icon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FolderKanbanIcon,
  HardHatIcon,
  RouteIcon,
  LayoutDashboardIcon,
  MapIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  HandshakeIcon,
  FileCheck2Icon,
  ArchiveIcon,
  BoxesIcon,
  WrenchIcon,
  GaugeIcon,
  SwordsIcon,
  UserCircleIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only strings already present in the module message files (drafts pending native review). */
  i18n?: { si?: string; ta?: string };
  /** Role hint: the item is hidden for other roles. Only a convenience; the server decides access. */
  roles?: readonly string[];
};

export type WorkspaceNavGroup = { label: string; items: readonly WorkspaceNavItem[] };

/** Only routes that exist today. Visibility rules are unchanged; the server enforces access. */
export const WORKSPACE_NAV: readonly WorkspaceNavGroup[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon }] },
  {
    label: "Operations",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanbanIcon, i18n: { si: "ව්‍යාපෘති", ta: "திட்டங்கள்" } },
      { href: "/projects/reviews", label: "Reviews", icon: ClipboardCheckIcon, i18n: { si: "ව්‍යාපෘති සමාලෝචන", ta: "திட்ட மதிப்பாய்வுகள்" } },
      { href: "/contractors", label: "Contractors", icon: HardHatIcon, i18n: { si: "කොන්ත්‍රාත්කරුවන්", ta: "ஒப்பந்ததாரர்கள்" } },
      { href: "/inspections", label: "Inspections", icon: ClipboardListIcon, i18n: { si: "පරීක්ෂා", ta: "ஆய்வுகள்" }, roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"] },
      { href: "/assets", label: "Assets", icon: BoxesIcon, i18n: { si: "වත්කම්", ta: "சொத்துகள்" }, roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"] },
      { href: "/maintenance", label: "Maintenance", icon: WrenchIcon, i18n: { si: "නඩත්තුව", ta: "பராமரிப்பு" }, roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"] },
      { href: "/finance", label: "Finance", icon: WalletIcon, i18n: { si: "මූල්‍ය", ta: "நிதி" }, roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"] },
      { href: "/roadsync", label: "RoadSync Dashboard", icon: LayoutDashboardIcon, i18n: { si: "RoadSync උපකරණ පුවරුව", ta: "RoadSync முகப்புப் பலகை" } },
      { href: "/roadsync/work-requests", label: "Work Requests", icon: RouteIcon, i18n: { si: "වැඩ ඉල්ලීම්", ta: "பணி கோரிக்கைகள்" } },
      { href: "/roadsync/conflicts", label: "Conflicts", icon: SwordsIcon, i18n: { si: "ගැටුම්", ta: "முரண்பாடுகள்" } },
      { href: "/roadsync/coordination", label: "Coordination", icon: HandshakeIcon, i18n: { si: "සම්බන්ධීකරණය", ta: "ஒருங்கிணைப்பு" } },
      { href: "/roadsync/approvals", label: "Approvals", icon: FileCheck2Icon, i18n: { si: "අනුමැතීන්", ta: "ஒப்புதல்கள்" } },
      { href: "/roadsync/history", label: "History", icon: ArchiveIcon, i18n: { si: "ඉතිහාසය", ta: "வரலாறு" } },
      { href: "/insights/coordination", label: "Agency insights", icon: GaugeIcon, i18n: { si: "ආයතන තීක්ෂ්ණ බුද්ධිය", ta: "முகமை நுண்ணறிவுகள்" }, roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"] },
      { href: "/inframap", label: "InfraMap", icon: MapIcon, i18n: { si: "InfraMap සිතියම", ta: "InfraMap வரைபடம்" } },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/notifications", label: "Notifications", icon: BellIcon },
      { href: "/admin/users", label: "Staff", icon: UsersIcon },
      { href: "/admin/agencies", label: "Agencies", icon: Building2Icon, i18n: { si: "ආයතන", ta: "நிறுவனங்கள்" } },
      { href: "/admin/roles", label: "Roles", icon: ShieldCheckIcon, i18n: { si: "භූමිකා", ta: "பாத்திரங்கள்" } },
      { href: "/profile", label: "Profile", icon: UserCircleIcon },
      { href: "/settings", label: "Settings", icon: SlidersHorizontalIcon },
    ],
  },
];

/** Missing SI/TA keys fall back to English (listed in docs/design phase report). */
export function navLabel(item: WorkspaceNavItem, locale: "en" | "si" | "ta"): string {
  if (locale === "en") return item.label;
  return item.i18n?.[locale] ?? item.label;
}

export function navCurrent(pathname: string, href: string): boolean {
  const reviews = pathname === "/projects/reviews" || /^\/projects\/[^/]+\/review$/.test(pathname);
  if (href === "/projects/reviews") return reviews;
  if (href === "/roadsync") return pathname === href || pathname.startsWith("/roadsync/dashboard");
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
