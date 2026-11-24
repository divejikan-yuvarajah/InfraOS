"use client";

import { BrandMark } from "@/components/common/brand-mark";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DropdownMenu } from "radix-ui";

import { logoutWithAuthClient } from "@/lib/auth/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { LOCALE_NAME, WORKSPACE_LOCALES, useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { useWorkspaceDensity, useWorkspaceReducedMotion } from "@/lib/i18n/workspace-preferences";
import { fetchNotices, fetchUnreadCount } from "@/lib/projects/notice-api";
import { noticeHref } from "@/lib/projects/notice-view";
import { fetchRecordSummary } from "@/lib/roadsync/conflict-records-api";
import { fetchHubSummary } from "@/lib/roadsync/coordination-api";

import { AiStatusChip } from "@/components/ai-admin/ai-status-chip";
import { DataSourceBadge } from "@/components/common/civic-atlas-primitives";
import { GlobalCommandPalette } from "./global-command-palette";
import { RealtimeProvider } from "@/components/notifications/realtime-provider";
import {
  ROLE_LABELS,
  WORKSPACE_NAV,
  initialsOf,
  navCurrent,
  navGroupLabel,
  navLabel,
} from "./workspace-nav";

import "@/styles/site-plan-legacy.css";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

const SHELL_COPY: Record<
  AuthLocale,
  {
    platformSub: string;
    demoEnv: string;
    agencyScope: string;
    allAgencies: string;
    collapseRail: string;
    expandRail: string;
    searchPlaceholder: string;
    civilCommand: string;
    telemetrySynced: string;
    profile: string;
    settings: string;
    notifications: string;
    signOut: string;
    signingOut: string;
    openNav: string;
    closeNav: string;
  }
> = {
  en: {
    platformSub: "Civic Atlas Command",
    demoEnv: "DEMO ENVIRONMENT",
    agencyScope: "Agency Scope",
    allAgencies: "All Agencies (National)",
    collapseRail: "Collapse Rail",
    expandRail: "Expand Rail",
    searchPlaceholder: "Search projects, work requests, assets... (⌘K / Ctrl+K)",
    civilCommand: "Civil Command",
    telemetrySynced: "Telemetry: Synced",
    profile: "Profile & Governance",
    settings: "Settings & Preferences",
    notifications: "Notifications Center",
    signOut: "Sign out",
    signingOut: "Signing out…",
    openNav: "Open navigation menu",
    closeNav: "Close navigation menu",
  },
  si: {
    platformSub: "ජාතික විධාන පද්ධතිය",
    demoEnv: "නිරූපණ පරිසරය",
    agencyScope: "ආයතන විෂය පථය",
    allAgencies: "සියලුම ආයතන (ජාතික)",
    collapseRail: "පැති තීරුව හකුළන්න",
    expandRail: "පැති තීරුව දිගහරින්න",
    searchPlaceholder: "ව්‍යාපෘති, වැඩ ඉල්ලීම්, වත්කම් සොයන්න... (⌘K / Ctrl+K)",
    civilCommand: "සිවිල් විධානය",
    telemetrySynced: "දත්ත: සමමුහුර්තයි",
    profile: "ගිණුම් පැතිකඩ",
    settings: "සැකසුම් සහ මනාප",
    notifications: "දැනුම්දීම් මධ්‍යස්ථානය",
    signOut: "ඉවත් වන්න",
    signingOut: "ඉවත් වෙමින්…",
    openNav: "යාත්‍රණ මෙනුව විවෘත කරන්න",
    closeNav: "යාත්‍රණ මෙනුව වසන්න",
  },
  ta: {
    platformSub: "தேசிய கட்டளை அமைப்பு",
    demoEnv: "மாதிரி சூழல்",
    agencyScope: "முகமை வரம்பு",
    allAgencies: "அனைத்து முகமைகள் (தேசிய)",
    collapseRail: "பக்கப்பட்டியைச் சுருக்கு",
    expandRail: "பக்கப்பட்டியை விரிவாக்கு",
    searchPlaceholder: "திட்டங்கள், பணி கோரிக்கைகள், சொத்துகளைத் தேடுக... (⌘K / Ctrl+K)",
    civilCommand: "சிவில் கட்டளை",
    telemetrySynced: "தரவு: ஒத்திசைக்கப்பட்டது",
    profile: "சுயவிவரம் & ஆளுகை",
    settings: "அமைப்புகள் & விருப்பங்கள்",
    notifications: "அறிவிப்புகள் மையம்",
    signOut: "வெளியேறு",
    signingOut: "வெளியேறுகிறது…",
    openNav: "வழிசெலுத்தல் மெனுவைத் திற",
    closeNav: "வழிசெலுத்தல் மெனுவை மூடு",
  },
};

function SidebarNavContent({
  pathname,
  locale,
  role,
  agencyDisplay,
  unreadCount,
  conflictCount,
  coordinationCount,
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  pathname: string;
  locale: AuthLocale;
  role: string;
  agencyDisplay: string;
  unreadCount: number;
  conflictCount: number;
  coordinationCount: number;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const copy = SHELL_COPY[locale];
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setClosedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="flex flex-col h-full bg-primary-container text-primary-fixed select-none">
      {/* Top Brand Header inside Sidebar */}
      <div className="h-[70px] px-5 flex items-center justify-between border-b border-white/[0.08] shrink-0">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 min-w-0"
        >
          <BrandMark size={36} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base leading-none">
                  INFRAOS
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-xs bg-white/10 text-primary-fixed-dim">
                  v2.4
                </span>
              </div>
              <p className="text-[11px] text-on-primary-container font-medium tracking-wide mt-1 truncate">
                {copy.platformSub}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Scrollable Navigation Groups */}
      <nav
        aria-label="Primary Workspace Navigation"
        className="flex-1 overflow-y-auto rail-scroll py-4 px-3 space-y-4"
      >
        {WORKSPACE_NAV.map((group) => {
          const visible = group.items.filter(
            (it) => !it.roles || !role || it.roles.includes(role),
          );
          if (visible.length === 0) return null;

          const hasActiveItem = visible.some((it) => navCurrent(pathname, it.href));
          const isGroupOpen = collapsed || hasActiveItem || !closedGroups[group.label];

          return (
            <div key={group.label}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isGroupOpen}
                  className="w-full px-3 py-1 mb-1 flex items-center justify-between rounded text-left hover:bg-white/[0.04] transition-colors"
                >
                  <span className="text-label-sm font-label-sm uppercase text-on-primary-container tracking-wider">
                    {navGroupLabel(group, locale)}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`material-symbols-outlined text-[15px] text-on-primary-container transition-transform duration-150 ${
                      isGroupOpen ? "rotate-0" : "-rotate-90"
                    }`}
                  >
                    expand_more
                  </span>
                </button>
              )}

              {isGroupOpen && (
                <ul
                  className={
                    !collapsed && group.hasThreadLine
                      ? "space-y-0.5 relative before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-white/[0.08]"
                      : "space-y-0.5"
                  }
                >
                {visible.map((item) => {
                  const active = navCurrent(pathname, item.href);
                  const text = navLabel(item, locale);
                  const badgeValue =
                    item.badgeKind === "conflicts"
                      ? conflictCount
                      : item.badgeKind === "coordination"
                        ? coordinationCount
                        : item.badgeKind === "notifications"
                          ? unreadCount
                          : 0;

                  const isCriticalNode = item.nodeTone === "critical";

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? text : undefined}
                        className={
                          active
                            ? "flex items-center justify-between px-3 py-2 rounded bg-white/[0.09] text-white font-medium text-body-md border-l-2 border-secondary-container transition-colors relative z-10"
                            : "flex items-center justify-between px-3 py-2 rounded text-primary-fixed-dim hover:text-white hover:bg-white/[0.04] text-body-md transition-colors group relative z-10"
                        }
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`material-symbols-outlined text-[18px] shrink-0 ${
                              active
                                ? "text-secondary-container"
                                : isCriticalNode && badgeValue > 0
                                  ? "text-[#ffb4ab] group-hover:text-secondary-fixed-dim"
                                  : "text-on-primary-container group-hover:text-primary-fixed"
                            }`}
                          >
                            {item.materialIcon}
                          </span>
                          {!collapsed && <span className="truncate">{text}</span>}
                        </div>

                        {!collapsed && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {badgeValue > 0 && item.badgeKind === "conflicts" && (
                              <>
                                <span
                                  className="text-[9px] text-[#ffb4ab]"
                                  title="Critical Spatial Overlap"
                                >
                                  ◆
                                </span>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-error text-white tabular-nums">
                                  {badgeValue > 99 ? "99+" : badgeValue}
                                </span>
                              </>
                            )}
                            {badgeValue > 0 && item.badgeKind === "coordination" && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-white/10 text-primary-fixed tabular-nums">
                                {badgeValue > 99 ? "99+" : badgeValue}
                              </span>
                            )}
                            {badgeValue > 0 && item.badgeKind === "notifications" && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-secondary-container text-white tabular-nums">
                                {badgeValue > 99 ? "99+" : badgeValue}
                              </span>
                            )}
                            {badgeValue === 0 && (
                              <span
                                className={
                                  active
                                    ? "text-[10px] text-secondary-container font-bold"
                                    : "text-[10px] text-on-primary-container"
                                }
                              >
                                {active ? "●" : item.nodeGlyph ?? "○"}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Sidebar Role & Environment Context Card */}
      <div className="p-3 border-t border-white/[0.08] bg-black/20 shrink-0">
        {!collapsed ? (
          <>
            <div className="p-2.5 rounded bg-white/[0.04] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs border border-dashed border-amber-400/50 text-amber-300 text-[10px] font-bold tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {copy.demoEnv}
                </span>
                <span className="text-[10px] font-mono text-on-primary-container uppercase truncate max-w-[90px]">
                  {role || "STAFF"}
                </span>
              </div>
              <div className="text-[11px] text-primary-fixed-dim leading-tight">
                <div className="font-semibold text-white truncate">
                  {copy.agencyScope}: {agencyDisplay}
                </div>
                <div className="text-on-primary-container mt-0.5 truncate">
                  {ROLE_LABELS[role] ?? role ?? "Authorized Staff"}
                </div>
              </div>
            </div>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="mt-2 w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-on-primary-container hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">dock_to_left</span>
                  <span>{copy.collapseRail}</span>
                </span>
                <kbd className="text-[10px] px-1 py-0.5 rounded bg-white/[0.06] text-on-primary-container font-mono">
                  [
                </kbd>
              </button>
            )}
          </>
        ) : (
          onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={copy.expandRail}
              className="w-full flex items-center justify-center py-2 rounded text-on-primary-container hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">dock_to_right</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

function LanguageSwitcher({
  locale,
  onChange,
}: {
  locale: AuthLocale;
  onChange: (l: AuthLocale) => void;
}) {
  return (
    <div
      className="flex items-center bg-surface-container-low p-0.5 rounded border border-outline-variant/40"
      role="group"
      aria-label="Interface language"
    >
      {WORKSPACE_LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            title={LOCALE_NAME[code]}
            onClick={() => onChange(code)}
            className={
              active
                ? "px-2 py-1 text-[11px] font-bold rounded-xs bg-surface-container-lowest text-on-surface shadow-2xs transition-colors"
                : "px-2 py-1 text-[11px] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            }
          >
            {code === "en" ? "EN" : code === "si" ? "සිංහල" : "தமிழ்"}
          </button>
        );
      })}
    </div>
  );
}

export type WorkspaceCrumb = { label: string; href?: string };

export function StaffWorkspaceShell({
  title,
  subtitle,
  description,
  context,
  section,
  breadcrumbs,
  scopeLabel,
  asOf,
  actions,
  wide,
  hidePageHeader = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  section?: string;
  breadcrumbs?: readonly WorkspaceCrumb[];
  scopeLabel?: string;
  asOf?: string;
  actions?: ReactNode;
  wide?: boolean;
  hidePageHeader?: boolean;
  children: ReactNode;
}) {
  const effectiveSubtitle = subtitle ?? description;
  void wide;
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("infraos:rail-collapsed:v1") === "1";
    } catch {
      return false;
    }
  });
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [locale, setLocale] = useWorkspaceLocale();
  const [density] = useWorkspaceDensity();
  const [reducedMotion] = useWorkspaceReducedMotion();

  const toggleRailCollapse = () => {
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("infraos:rail-collapsed:v1", next ? "1" : "0");
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggleRailCollapse();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const copy = SHELL_COPY[locale];

  const displayName = useAuthPart(() => {
    const u = getMemorySession()?.user;
    if (!u) return "";
    return u.displayName || `${u.firstName} ${u.lastName}`.trim() || u.email;
  });
  const role = useAuthPart(() => getMemorySession()?.user?.roleKey ?? "");
  const agency = useAuthPart(() => getMemorySession()?.user?.agencyId ?? "");
  const roleLabel = ROLE_LABELS[role] ?? role;
  const epoch = useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
  const hasToken = useSyncExternalStore(
    subscribeAuth,
    () => Boolean(getMemoryAccessToken()),
    () => false,
  );

  const unreadQuery = useQuery({
    queryKey: ["notifications", "unread-count", epoch],
    queryFn: fetchUnreadCount,
    enabled: hasToken,
    staleTime: 30_000,
  });
  const unreadCount = unreadQuery.data ?? 0;

  const noticesPopoverQuery = useQuery({
    queryKey: ["projects", "notices-popover", epoch],
    queryFn: () => fetchNotices("all"),
    enabled: hasToken && notifPopoverOpen,
    staleTime: 30_000,
  });

  const conflictSummaryQuery = useQuery({
    queryKey: ["roadsync", "conflicts-summary", epoch],
    queryFn: fetchRecordSummary,
    enabled: hasToken,
    staleTime: 30_000,
  });
  const conflictCount = conflictSummaryQuery.data?.needsMyAck ?? 0;

  const coordSummaryQuery = useQuery({
    queryKey: ["roadsync", "coordination-summary", epoch],
    queryFn: fetchHubSummary,
    enabled: hasToken,
    staleTime: 30_000,
  });
  const coordinationCount =
    (coordSummaryQuery.data?.needsMyResponse ?? 0) +
    (coordSummaryQuery.data?.escalated ?? 0);

  const isRawObjectId = /^[0-9a-f]{24}$/i.test(agency);
  const readableAgency =
    role === "SUPER_ADMIN"
      ? copy.allAgencies
      : agency && !isRawObjectId
        ? agency
        : role
          ? copy.agencyScope
          : copy.allAgencies;
  const effectiveScope = scopeLabel || readableAgency;

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await logoutWithAuthClient();
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-surface text-on-surface"
      data-infra-app=""
      data-civic-command=""
      data-density={density}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      {/* 1. LEFT NAVIGATION RAIL (Desktop Collapsible Command Rail) */}
      <aside
        aria-label="Command Rail"
        className={`hidden lg:flex flex-col shrink-0 z-30 shadow-xl transition-[width] duration-200 ${
          railCollapsed ? "w-[72px]" : "w-[264px]"
        }`}
      >
        <SidebarNavContent
          pathname={pathname}
          locale={locale}
          role={role}
          agencyDisplay={effectiveScope}
          unreadCount={unreadCount}
          conflictCount={conflictCount}
          coordinationCount={coordinationCount}
          collapsed={railCollapsed}
          onToggleCollapse={toggleRailCollapse}
        />
      </aside>

      {/* Mobile / Tablet Navigation Drawer */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-primary/60 backdrop-blur-xs lg:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[86vw] shadow-2xl lg:hidden focus:outline-none"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={copy.closeNav}
                className="absolute top-5 right-3 z-20 p-1.5 rounded text-primary-fixed-dim hover:text-white hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <SidebarNavContent
                pathname={pathname}
                locale={locale}
                role={role}
                agencyDisplay={effectiveScope}
                unreadCount={unreadCount}
                conflictCount={conflictCount}
                coordinationCount={coordinationCount}
                collapsed={false}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 2. MAIN WORKSPACE WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface overflow-hidden">
        {/* TOP GLOBAL HEADER BAR (h-[60px]) */}
        <header className="h-[60px] bg-surface-container-lowest border-b border-outline-variant/30 px-4 sm:px-gutter-desktop flex items-center justify-between gap-3 shrink-0 z-20">
          {/* Left: Mobile Trigger + Breadcrumb & Command Context */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0 max-w-[240px] 2xl:max-w-[340px]">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={copy.openNav}
              className="lg:hidden p-2 rounded text-on-surface-variant hover:bg-surface-container-low shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-xs min-w-0">
              <Link
                href="/dashboard"
                className="hidden 2xl:inline text-on-surface-variant font-medium hover:text-on-surface transition-colors shrink-0"
              >
                {copy.civilCommand}
              </Link>
              <span className="hidden 2xl:inline text-outline-variant">/</span>
              {breadcrumbs && breadcrumbs.length > 0 ? (
                breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <span key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5 min-w-0">
                      {crumb.href && !isLast ? (
                        <Link
                          href={crumb.href}
                          className="text-on-surface-variant hover:text-on-surface truncate max-w-[120px]"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span
                          aria-current={isLast ? "page" : undefined}
                          className="font-semibold text-on-surface flex items-center gap-1.5 truncate max-w-[180px]"
                        >
                          <span className="w-2 h-2 rounded-full bg-secondary-container shrink-0" />
                          <span className="truncate">{crumb.label}</span>
                        </span>
                      )}
                      {!isLast && <span className="text-outline-variant">/</span>}
                    </span>
                  );
                })
              ) : (
                <span className="font-semibold text-on-surface flex items-center gap-1.5 truncate max-w-[190px]">
                  <span className="w-2 h-2 rounded-full bg-secondary-container shrink-0" />
                  <span className="truncate">{title}</span>
                </span>
              )}
            </nav>
          </div>

          {/* Center: Global Search / Command Palette Trigger (CORE-01.16) */}
          <div className="flex-1 min-w-[160px] max-w-sm mx-1 sm:mx-2">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Open Global Search and Command Palette"
              className="relative w-full flex items-center justify-between bg-surface-container-low hover:bg-surface-container border border-outline-variant/50 rounded py-1.5 pl-3 pr-2.5 text-body-md text-outline transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary transition-colors">
                  search
                </span>
                <span className="truncate text-left text-[13px]">
                  {copy.searchPlaceholder}
                </span>
              </span>
              <span className="hidden sm:flex items-center gap-1 shrink-0 ml-2">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-on-surface-variant bg-surface-container-lowest rounded border border-outline-variant/40 shadow-2xs">
                  ⌘K
                </kbd>
              </span>
            </button>
          </div>

          {/* Right: Environment Chip, Multilingual Switcher, Notifications, Telemetry & Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Honesty / Environment Chip */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xs border border-dashed border-outline-variant text-on-surface-variant text-[11px] font-bold tracking-wider uppercase"
              title="Non-production demonstration workspace"
            >
              <span>[ DEMO ]</span>
            </div>

            {/* Multilingual Switcher (EN | සිංහල | தமிழ்) */}
            <LanguageSwitcher locale={locale} onChange={setLocale} />

            {/* Divider */}
            <div className="hidden sm:block h-5 w-[1px] bg-outline-variant/30" />

            {/* Notification Bell with CORE-01.19 Header Popover */}
            <DropdownMenu.Root open={notifPopoverOpen} onOpenChange={setNotifPopoverOpen}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={
                    unreadCount > 0
                      ? `${copy.notifications} (${unreadCount} unread)`
                      : copy.notifications
                  }
                  className={`relative p-2 rounded transition-colors ${
                    pathname.startsWith("/notifications") || notifPopoverOpen
                      ? "bg-secondary-fixed text-on-secondary-fixed border border-secondary/30"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {pathname.startsWith("/notifications") || notifPopoverOpen
                      ? "notifications_active"
                      : "notifications"}
                  </span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary-container ring-2 ring-white" />
                  )}
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  data-civic-command=""
                  className="z-50 w-[360px] max-w-[92vw] rounded bg-surface-container-lowest border border-outline-variant/40 shadow-ambient overflow-hidden text-on-surface"
                >
                  <div className="px-4 py-3 bg-[#14202d] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-secondary-container">
                        notifications_active
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {copy.notifications}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-xs bg-secondary/25 border border-secondary/40 text-[#ffb59a] text-[10px] font-mono font-bold tabular-nums">
                      {unreadCount} ACTIVE
                    </span>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto divide-y divide-outline-variant/20">
                    {(noticesPopoverQuery.data?.notices ?? []).slice(0, 4).map((item) => {
                      const isCrit = item.type === "CONFLICT" || item.type === "COORDINATION";
                      const href = noticeHref(item) || "/notifications";
                      return (
                        <DropdownMenu.Item key={item.id} asChild>
                          <Link
                            href={href}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-low/70 outline-none cursor-pointer transition-colors"
                          >
                            <span
                              className={`mt-0.5 text-xs font-mono font-bold ${
                                isCrit ? "text-error" : "text-secondary"
                              }`}
                            >
                              {isCrit ? "◆" : item.isRead ? "○" : "●"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                                  {item.project?.projectCode || item.type}
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-xs ${
                                    isCrit
                                      ? "bg-error-container text-on-error-container"
                                      : "bg-secondary-fixed text-on-secondary-fixed"
                                  }`}
                                >
                                  {item.type}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-on-surface mt-0.5 truncate">
                                {item.project?.title || item.titleKey}
                              </p>
                              <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1 font-mono">
                                {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </Link>
                        </DropdownMenu.Item>
                      );
                    })}
                    {noticesPopoverQuery.data && noticesPopoverQuery.data.notices.length === 0 && (
                      <div className="px-4 py-6 text-center text-xs text-on-surface-variant">
                        All corridor and statutory dispatch alerts are clear.
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-surface-container-low border-t border-outline-variant/25 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-on-surface-variant">
                      [ CLIENT TRIAGE SYNC ]
                    </span>
                    <DropdownMenu.Item asChild>
                      <Link
                        href="/notifications"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary-container hover:bg-primary text-white text-xs font-semibold outline-none cursor-pointer transition-colors"
                      >
                        <span>Open Alert Center</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </DropdownMenu.Item>
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Data Source Honesty Indicator */}
            <div className="hidden 2xl:flex items-center">
              <DataSourceBadge kind={hasToken ? "live" : "demo"} />
            </div>

            <AiStatusChip />

            {/* User Profile Trigger Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded hover:bg-surface-container-low transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded bg-primary-container text-white flex items-center justify-center font-semibold text-xs border border-outline-variant/30 shrink-0">
                    {initialsOf(displayName || "Staff")}
                  </div>
                  <div className="hidden md:block leading-tight max-w-[140px]">
                    <div className="text-xs font-semibold text-on-surface truncate">
                      {displayName || "Authenticated Staff"}
                    </div>
                    <div className="text-[10px] text-on-surface-variant font-medium truncate">
                      {roleLabel || "Staff"}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-outline">
                    expand_more
                  </span>
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  data-civic-command=""
                  className="z-50 min-w-[240px] rounded bg-surface-container-lowest border border-outline-variant/40 shadow-ambient p-1.5 text-on-surface"
                >
                  <div className="px-3 py-2.5 border-b border-outline-variant/25">
                    <div className="text-xs font-bold text-on-surface truncate">
                      {displayName || "Authenticated Staff"}
                    </div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                      {roleLabel}
                      {readableAgency ? ` · ${readableAgency}` : ""}
                    </div>
                  </div>

                  <div className="py-1">
                    <DropdownMenu.Item asChild>
                      <Link
                        href="/profile"
                        className="flex items-center gap-2.5 px-3 py-2 rounded text-body-md text-on-surface hover:bg-surface-container-low outline-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                          person
                        </span>
                        <span>{copy.profile}</span>
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                      <Link
                        href="/settings"
                        className="flex items-center gap-2.5 px-3 py-2 rounded text-body-md text-on-surface hover:bg-surface-container-low outline-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                          settings
                        </span>
                        <span>{copy.settings}</span>
                      </Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                      <Link
                        href="/notifications"
                        className="flex items-center justify-between px-3 py-2 rounded text-body-md text-on-surface hover:bg-surface-container-low outline-none cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                            notifications
                          </span>
                          <span>{copy.notifications}</span>
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-secondary-container text-white tabular-nums">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </DropdownMenu.Item>
                  </div>

                  <DropdownMenu.Separator className="h-[1px] bg-outline-variant/25 my-1" />

                  <DropdownMenu.Item
                    disabled={loggingOut}
                    onSelect={(e) => {
                      e.preventDefault();
                      void handleSignOut();
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-body-md text-error hover:bg-error-container/30 outline-none cursor-pointer font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>{loggingOut ? copy.signingOut : copy.signOut}</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        {/* SCROLLABLE WORKSPACE CONTENT CANVAS */}
        <main className="flex-1 overflow-y-auto main-scroll bg-surface">
          {!hidePageHeader && (
            <>
              <div className="cac-survey-header px-4 sm:px-gutter-desktop py-2.5 sm:py-3">
                <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#ffb597] mb-0.5 flex-wrap">
                      <span className="material-symbols-outlined text-[13px]">share_location</span>
                      <span>{section ?? copy.civilCommand}</span>
                      <span className="text-white/30">/</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-200 border border-white/15 normal-case">
                        {effectiveScope}
                      </span>
                      <DataSourceBadge
                        kind={hasToken ? "live" : "demo"}
                        asOf={asOf}
                      />
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
                      {title}
                    </h1>
                    {effectiveSubtitle && (
                      <div className="text-xs text-slate-300 mt-0.5 max-w-3xl leading-snug line-clamp-2">
                        {effectiveSubtitle}
                      </div>
                    )}
                  </div>
                  {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
                </div>
              </div>
              {context && (
                <div className="bg-surface-container-lowest border-b border-outline-variant/25 px-4 sm:px-gutter-desktop py-2">
                  <div className="max-w-[1600px] mx-auto">{context}</div>
                </div>
              )}
            </>
          )}

          <div
            className={
              hidePageHeader
                ? "min-h-full"
                : "max-w-[1600px] mx-auto px-4 sm:px-gutter-desktop py-4 pb-10"
            }
          >
            {children}
          </div>
        </main>
      </div>

      <RealtimeProvider />
      {/* Global Command Palette & Search Modal (CORE-01.16 – CORE-01.18) */}
      <GlobalCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        epoch={epoch}
        hasToken={hasToken}
        scopeLabel={effectiveScope}
        roleLabel={roleLabel || "Staff"}
      />
    </div>
  );
}
