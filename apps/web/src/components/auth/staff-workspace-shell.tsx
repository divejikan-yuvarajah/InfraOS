"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DropdownMenu } from "radix-ui";
import { BellIcon, Building2Icon, ChevronDownIcon, LogOutIcon, MenuIcon, XIcon } from "lucide-react";

import { InfraosMark } from "@/components/landing/infraos-mark";
import { RouteLines } from "@/components/motif/connected-motif";
import { logoutWithAuthClient } from "@/lib/auth/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { fetchUnreadCount } from "@/lib/projects/notice-api";
import { classifyEditError } from "@/lib/projects/edit-outcome";

import { ROLE_LABELS, WORKSPACE_NAV, initialsOf, navCurrent } from "./workspace-nav";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function SidebarNav({
  pathname,
  unread,
  hideNotices,
  onNavigate,
}: {
  pathname: string;
  unread: number | undefined;
  hideNotices: boolean;
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
              {items.map(({ href, label, icon: Icon }) => {
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
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
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
    <div data-infra-app className="auth-access-root mc-root">
      <a href="#mc-main" className="mc-skip">
        Skip to content
      </a>
      <aside className="mc-sidebar" aria-label="Sidebar">
        <SidebarBrand scopeLabel={scopeLabel} />
        <SidebarNav pathname={pathname} unread={unreadCount} hideNotices={hideNotices} />
        <p className="mc-sidebar-foot">{kicker}</p>
      </aside>

      <div className="mc-frame">
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
                  hideNotices={hideNotices}
                  onNavigate={() => setDrawer(false)}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <p className="mc-topbar-title">{title}</p>
          <div className="mc-topbar-spacer" />
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
          </header>
          <div className={wide ? "auth-access-main is-wide mc-body" : "auth-access-main mc-body is-narrow"}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
