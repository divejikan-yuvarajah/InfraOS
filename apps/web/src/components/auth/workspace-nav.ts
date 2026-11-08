import type { LucideIcon } from "lucide-react";
import {
  ArchiveIcon,
  BellIcon,
  BoxesIcon,
  Building2Icon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileCheck2Icon,
  LibraryIcon,
  FolderKanbanIcon,
  GaugeIcon,
  HandshakeIcon,
  HardHatIcon,
  LayoutDashboardIcon,
  MapIcon,
  RouteIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SwordsIcon,
  UserCircleIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "lucide-react";

export type WorkspaceNavNodeGlyph = "●" | "○" | "◆" | "✓" | "⊗";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  materialIcon: string;
  nodeGlyph?: WorkspaceNavNodeGlyph;
  nodeTone?: "active" | "critical" | "success" | "neutral";
  badgeKind?: "conflicts" | "coordination" | "notifications";
  /** Localized strings for Sinhala and Tamil. */
  i18n?: { si?: string; ta?: string };
  /** Role hint: the item is hidden for other roles. Only a convenience; the server decides access. */
  roles?: readonly string[];
};

export type WorkspaceNavGroup = {
  label: string;
  i18n?: { si?: string; ta?: string };
  hasThreadLine?: boolean;
  items: readonly WorkspaceNavItem[];
};

/** Only routes that exist today. Visibility rules are unchanged; the server enforces access. */
export const WORKSPACE_NAV: readonly WorkspaceNavGroup[] = [
  {
    label: "Overview",
    i18n: { si: "දළ විශ්ලේෂණය", ta: "மேலோட்டம்" },
    hasThreadLine: false,
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboardIcon,
        materialIcon: "dashboard",
        nodeGlyph: "●",
        nodeTone: "active",
      },
      {
        href: "/portal/public",
        label: "Public Portal",
        icon: MapIcon,
        materialIcon: "public",
        nodeGlyph: "○",
        i18n: { si: "මහජන ද්වාරය", ta: "பொது தளம்" },
      },
    ],
  },
  {
    label: "Project Operations",
    i18n: { si: "ව්‍යාපෘති මෙහෙයුම්", ta: "திட்ட செயல்பாடுகள்" },
    hasThreadLine: true,
    items: [
      {
        href: "/projects",
        label: "Projects",
        icon: FolderKanbanIcon,
        materialIcon: "assignment",
        nodeGlyph: "○",
        i18n: { si: "ව්‍යාපෘති", ta: "திட்டங்கள்" },
      },
      {
        href: "/projects/reviews",
        label: "Project Reviews",
        icon: ClipboardCheckIcon,
        materialIcon: "rate_review",
        nodeGlyph: "○",
        i18n: { si: "ව්‍යාපෘති සමාලෝචන", ta: "திட்ட மதிப்பாய்வுகள்" },
      },
      {
        href: "/contractors",
        label: "Contractors",
        icon: HardHatIcon,
        materialIcon: "engineering",
        nodeGlyph: "○",
        i18n: { si: "කොන්ත්‍රාත්කරුවන්", ta: "ஒப்பந்ததாரர்கள்" },
      },
      {
        href: "/inspections",
        label: "Inspections",
        icon: ClipboardListIcon,
        materialIcon: "fact_check",
        nodeGlyph: "○",
        i18n: { si: "පරීක්ෂා", ta: "ஆய்வுகள்" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"],
      },
      {
        href: "/assets",
        label: "Assets",
        icon: BoxesIcon,
        materialIcon: "inventory_2",
        nodeGlyph: "○",
        i18n: { si: "වත්කම්", ta: "சொத்துகள்" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"],
      },
      {
        href: "/documents",
        label: "DocTrace",
        icon: LibraryIcon,
        materialIcon: "folder_open",
        nodeGlyph: "○",
        i18n: { si: "ලේඛන (DocTrace)", ta: "ஆவணங்கள் (DocTrace)" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"],
      },
      {
        href: "/documents/processing",
        label: "AI Processing",
        icon: ScanSearchIcon,
        materialIcon: "manage_search",
        nodeGlyph: "○",
        i18n: { si: "AI සැකසීම", ta: "AI செயலாக்கம்" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"],
      },
      {
        href: "/maintenance",
        label: "Maintenance",
        icon: WrenchIcon,
        materialIcon: "build",
        nodeGlyph: "○",
        i18n: { si: "නඩත්තුව", ta: "பராமரிப்பு" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER", "INSPECTOR"],
      },
      {
        href: "/finance",
        label: "Finance",
        icon: WalletIcon,
        materialIcon: "account_balance",
        nodeGlyph: "○",
        i18n: { si: "මූල්‍ය", ta: "நிதி" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"],
      },
    ],
  },
  {
    label: "Coordination Intelligence",
    i18n: { si: "සම්බන්ධීකරණ බුද්ධිය", ta: "ஒருங்கிணைப்பு நுண்ணறிவு" },
    hasThreadLine: true,
    items: [
      {
        href: "/roadsync",
        label: "RoadSync",
        icon: LayoutDashboardIcon,
        materialIcon: "hub",
        nodeGlyph: "○",
        i18n: { si: "RoadSync", ta: "RoadSync" },
      },
      {
        href: "/roadsync/work-requests",
        label: "Work Requests",
        icon: RouteIcon,
        materialIcon: "edit_road",
        nodeGlyph: "○",
        i18n: { si: "වැඩ ඉල්ලීම්", ta: "பணி கோரிக்கைகள்" },
      },
      {
        href: "/roadsync/conflicts",
        label: "Conflicts",
        icon: SwordsIcon,
        materialIcon: "warning",
        nodeGlyph: "◆",
        nodeTone: "critical",
        badgeKind: "conflicts",
        i18n: { si: "ගැටුම්", ta: "முரண்பாடுகள்" },
      },
      {
        href: "/roadsync/coordination",
        label: "Coordination",
        icon: HandshakeIcon,
        materialIcon: "handshake",
        nodeGlyph: "○",
        badgeKind: "coordination",
        i18n: { si: "සම්බන්ධීකරණය", ta: "ஒருங்கிணைப்பு" },
      },
      {
        href: "/roadsync/approvals",
        label: "Approvals",
        icon: FileCheck2Icon,
        materialIcon: "verified",
        nodeGlyph: "✓",
        i18n: { si: "අනුමැතීන්", ta: "ஒப்புதல்கள்" },
      },
      {
        href: "/roadsync/history",
        label: "History",
        icon: ArchiveIcon,
        materialIcon: "history",
        nodeGlyph: "○",
        i18n: { si: "ඉතිහාසය", ta: "வரலாறு" },
      },
      {
        href: "/insights/coordination",
        label: "Agency Insights",
        icon: GaugeIcon,
        materialIcon: "analytics",
        nodeGlyph: "○",
        i18n: { si: "ආයතන තීක්ෂ්ණ බුද්ධිය", ta: "முகமை நுண்ணறிவுகள்" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"],
      },
      {
        href: "/inframap",
        label: "InfraMap",
        icon: MapIcon,
        materialIcon: "map",
        nodeGlyph: "○",
        i18n: { si: "InfraMap සිතියම", ta: "InfraMap வரைபடம்" },
      },
    ],
  },
  {
    label: "Administration",
    i18n: { si: "පරිපාලනය", ta: "நிர்வாகம்" },
    hasThreadLine: false,
    items: [
      {
        href: "/admin/governance",
        label: "Governance",
        icon: ShieldCheckIcon,
        materialIcon: "shield_person",
        nodeGlyph: "●",
        nodeTone: "active",
        i18n: { si: "පාලනය", ta: "ஆளுகை" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN"],
      },
      {
        href: "/admin/users",
        label: "Staff",
        icon: UsersIcon,
        materialIcon: "badge",
        nodeGlyph: "○",
      },
      {
        href: "/admin/agencies",
        label: "Agencies",
        icon: Building2Icon,
        materialIcon: "domain",
        nodeGlyph: "○",
        i18n: { si: "ආයතන", ta: "நிறுவனங்கள்" },
      },
      {
        href: "/admin/roles",
        label: "Roles",
        icon: ShieldCheckIcon,
        materialIcon: "admin_panel_settings",
        nodeGlyph: "○",
        i18n: { si: "භූමිකා", ta: "பாத்திரங்கள்" },
      },
      {
        href: "/admin/audit-logs",
        label: "Audit Ledger",
        icon: ClipboardListIcon,
        materialIcon: "policy",
        nodeGlyph: "○",
        i18n: { si: "විගණන ලෙජරය", ta: "தணிக்கை பதிவேடு" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN"],
      },
      {
        href: "/admin/system",
        label: "System Core",
        icon: SlidersHorizontalIcon,
        materialIcon: "dns",
        nodeGlyph: "○",
        i18n: { si: "පද්ධති වින්‍යාසය", ta: "கணினி கட்டமைப்பு" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN"],
      },
      {
        href: "/admin/security-alerts",
        label: "Security Alerts",
        icon: BellIcon,
        materialIcon: "gpp_maybe",
        nodeGlyph: "◆",
        nodeTone: "critical",
        i18n: { si: "ආරක්ෂක අනතුරු ඇඟවීම්", ta: "பாதுகாப்பு எச்சரிக்கைகள்" },
        roles: ["SUPER_ADMIN", "GOV_ADMIN"],
      },
    ],
  },
  {
    label: "Personal Workspace",
    i18n: { si: "පුද්ගලික වැඩබිම", ta: "தனிப்பட்ட பணியிடம்" },
    hasThreadLine: false,
    items: [
      {
        href: "/notifications",
        label: "Notifications",
        icon: BellIcon,
        materialIcon: "notifications",
        nodeGlyph: "○",
        badgeKind: "notifications",
      },
      {
        href: "/profile",
        label: "Profile",
        icon: UserCircleIcon,
        materialIcon: "person",
        nodeGlyph: "○",
      },
      {
        href: "/settings",
        label: "Settings",
        icon: SlidersHorizontalIcon,
        materialIcon: "settings",
        nodeGlyph: "○",
      },
    ],
  },
];

/** Missing SI/TA keys fall back to English (listed in docs/design phase report). */
export function navLabel(item: WorkspaceNavItem, locale: "en" | "si" | "ta"): string {
  if (locale === "en") return item.label;
  return item.i18n?.[locale] ?? item.label;
}

export function navGroupLabel(group: WorkspaceNavGroup, locale: "en" | "si" | "ta"): string {
  if (locale === "en") return group.label;
  return group.i18n?.[locale] ?? group.label;
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
