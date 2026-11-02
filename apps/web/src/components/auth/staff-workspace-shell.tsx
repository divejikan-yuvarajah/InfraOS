"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DropdownMenu } from "radix-ui";
import { BellIcon, Building2Icon, ChevronDownIcon, LogOutIcon, MenuIcon, XIcon } from "lucide-react";

import { InfraosMark } from "@/components/landing/infraos-mark";
import { RouteLines } from "@/components/motif/connected-motif";
import { HonestyChip } from "@/components/site-plan/site-plan";
import { logoutWithAuthClient } from "@/lib/auth/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { LOCALE_NAME, LOCALE_SHORT, WORKSPACE_LOCALES, useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fetchUnreadCount } from "@/lib/projects/notice-api";
import { fetchRecordSummary } from "@/lib/roadsync/conflict-records-api";
import { classifyEditError } from "@/lib/projects/edit-outcome";

import { ROLE_LABELS, WORKSPACE_NAV, initialsOf, navCurrent, navLabel } from "./workspace-nav";

import "@/styles/site-plan-legacy.css";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function SidebarNav({
  pathname,
  unread,
  conflicts,
  hideNotices,
  locale,
  onNavigate,
}: {
  pathname: string;
  unread: number | undefined;
  /** Step 73: needs-my-acknowledgement count, with a maroon dot when any is overdue. */
  conflicts?: { count: number; overdue: boolean };
  hideNotices: boolean;
  locale: AuthLocale;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Staff workspace" className="mc-nav">
      {WORKSPACE_NAV.map((group) => {
        const items = group.items.filter((i) => i.href !== "/notifications" || !hideNotices);
        return (
          <div key={group.label} className="mc-nav-group">
            <p className="mc-nav-label">{group.label}</p>
            <ul>
              {items.map((item) => {
                const { href, icon: Icon } = item;
                const label = navLabel(item, locale);
                const active = navCurrent(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={active ? "mc-nav-link is-active" : "mc-nav-link"}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="mc-nav-icon" aria-hidden="true" />
                      <span className="mc-nav-text">{label}</span>
                      {href === "/notifications" && typeof unread === "number" && unread > 0 ? (
                        <span className="mc-nav-count">{unread}</span>
                      ) : null}
                      {href === "/roadsync/conflicts" && conflicts && conflicts.count > 0 ? (
                        <span className="mc-nav-count" data-overdue={conflicts.overdue ? "true" : undefined}>{conflicts.count}{conflicts.overdue ? <span className="sr-only"> overdue</span> : null}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ scopeLabel }: { scopeLabel: string | null }) {
  return (
    <div className="mc-brand">
      <Link href="/dashboard" className="mc-brand-link" aria-label="INFRAOS dashboard">
        <InfraosMark variant="light" className="mc-brand-mark" />
        <span className="mc-brand-word">INFRAOS</span>
      </Link>
      {scopeLabel ? (
        <p className="mc-scope-chip">
          <Building2Icon aria-hidden="true" />
          <span>{scopeLabel}</span>
        </p>
      ) : null}
    </div>
  );
}

export function StaffWorkspaceShell({
  kicker = "INFRAOS",
  title,
  description,
  wide = false,
  context,
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
  wide?: boolean;
  /** Optional Site Plan context bar (breadcrumbs, scope, as-of, actions) under the page title. */
  context?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [locale, setLocale] = useWorkspaceLocale();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const displayName = useAuthPart(() => getMemorySession()?.user.displayName ?? "");
  const hasAgency = useAuthPart(() => (getMemorySession()?.user.agencyId ? "yes" : "no")) === "yes";
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no")) === "yes";
  const unread = useQuery({
    queryKey: ["notifications-count", epoch, userId, roleKey],
    enabled: signedIn,
    queryFn: () => fetchUnreadCount(),
  });
  const conflictSummary = useQuery({
    queryKey: ["roadsync", "conflict-nav", epoch, userId, roleKey],
    enabled: signedIn && hasAgency,
    queryFn: () => fetchRecordSummary(),
    retry: false,
    refetchOnWindowFocus: true,
  });
  const conflictBadge = conflictSummary.data ? { count: conflictSummary.data.needsMyAck, overdue: conflictSummary.data.overdue > 0 } : undefined;
  const hideNotices = !signedIn || (unread.error ? classifyEditError(unread.error) === "denied" : false);
  const unreadCount = typeof unread.data === "number" ? unread.data : undefined;
  const roleLabel = ROLE_LABELS[roleKey] ?? roleKey;
  // The session carries only an agency id, so the chip states scope, not an agency name.
  const scopeLabel = signedIn && hasAgency ? "Agency scope" : null;

  async function signOut() {
    setLeaving(true);
    await logoutWithAuthClient();
    router.replace("/");
  }

  return (
    <div data-infra-app className="auth-access-root mc-root" lang={locale}>
      <a href="#mc-main" className="mc-skip">
        Skip to content
      </a>
      <aside className="mc-sidebar" aria-label="Sidebar">
        <SidebarBrand scopeLabel={scopeLabel} />
        <SidebarNav pathname={pathname} unread={unreadCount} conflicts={conflictBadge} hideNotices={hideNotices} locale={locale} />
        <p className="mc-sidebar-foot">{kicker}</p>
      </aside>

      <div className="mc-frame sp-canvas">
        <header className="mc-topbar">
          <Dialog.Root open={drawer} onOpenChange={setDrawer}>
            <Dialog.Trigger className="mc-icon-btn mc-menu-btn" aria-label="Open navigation">
              <MenuIcon aria-hidden="true" />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="mc-scrim" />
              <Dialog.Content className="mc-drawer" data-infra-app aria-describedby={undefined}>
                <Dialog.Title className="mc-sr">Navigation</Dialog.Title>
                <Dialog.Close className="mc-icon-btn mc-drawer-close" aria-label="Close navigation">
                  <XIcon aria-hidden="true" />
                </Dialog.Close>
                <SidebarBrand scopeLabel={scopeLabel} />
                <SidebarNav
                  pathname={pathname}
                  unread={unreadCount}
                  conflicts={conflictBadge}
                  hideNotices={hideNotices}
                  locale={locale}
                  onNavigate={() => setDrawer(false)}
                />
                <p className="mc-drawer-env">
                  <HonestyChip kind="demo" />
                </p>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <p className="mc-topbar-title">{title}</p>
          <div className="mc-topbar-spacer" />
          <span className="mc-env">
            <HonestyChip kind="demo" />
          </span>
          <span className="mc-env-compact">
            <HonestyChip kind="demo" label="Demo" />
          </span>
          <div className="mc-lang" role="group" aria-label="View language (Sinhala and Tamil are drafts pending native review)">
            {WORKSPACE_LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={locale === code}
                aria-label={LOCALE_NAME[code]}
                className={locale === code ? "is-current" : undefined}
                onClick={() => setLocale(code)}
              >
                {LOCALE_SHORT[code]}
              </button>
            ))}
          </div>
          {!hideNotices ? (
            <Link
              href="/notifications"
              className="mc-icon-btn mc-bell"
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
            >
              <BellIcon aria-hidden="true" />
              {unreadCount ? (
                <span className="mc-bell-count" aria-hidden="true">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          {signedIn ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="mc-user-btn" aria-label="User menu">
                <span className="mc-avatar" aria-hidden="true">
                  {initialsOf(displayName)}
                </span>
                <span className="mc-user-meta">
                  <span className="mc-user-name">{displayName}</span>
                  <span className="mc-user-role">{roleLabel}</span>
                </span>
                <ChevronDownIcon className="mc-user-chev" aria-hidden="true" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="mc-menu" data-infra-app>
                  <div className="mc-menu-head">
                    <p>{displayName}</p>
                    <p>
                      {roleLabel}
                      {scopeLabel ? ` · ${scopeLabel}` : ""}
                    </p>
                  </div>
                  <DropdownMenu.Item asChild>
                    <Link href="/profile" className="mc-menu-item">
                      Profile
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/settings" className="mc-menu-item">
                      Settings
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="mc-menu-sep" />
                  <DropdownMenu.Item className="mc-menu-item" disabled={leaving} onSelect={() => void signOut()}>
                    <LogOutIcon aria-hidden="true" /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </header>

        <main id="mc-main" className="mc-main" tabIndex={-1}>
          <header className="mc-page-header">
            <RouteLines className="mc-page-header-motif" />
            <h1 className="mc-title">{title}</h1>
            {description ? <p className="mc-description">{description}</p> : null}
            {context ? <div className="mc-page-context">{context}</div> : null}
          </header>
          <div className={wide ? "auth-access-main is-wide mc-body" : "auth-access-main mc-body is-narrow"}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
