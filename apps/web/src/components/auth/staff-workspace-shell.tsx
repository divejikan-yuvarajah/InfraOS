"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { fetchUnreadCount } from "@/lib/projects/notice-api";
import { classifyEditError } from "@/lib/projects/edit-outcome";

const NAV = [
  { href: "/dashboard", label: "Workspace" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/admin/users", label: "Staff" },
  { href: "/admin/agencies", label: "Agencies" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/projects", label: "Projects" },
  { href: "/projects/reviews", label: "Reviews" },
  { href: "/notifications", label: "Notices" },
] as const;

function navCurrent(pathname: string, href: string): boolean {
  if (href === "/projects/reviews") return pathname === href || pathname.endsWith("/review");
  return pathname === href;
}

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
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
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no")) === "yes";
  const unread = useQuery({
    queryKey: ["notifications-count", epoch, userId, roleKey],
    enabled: signedIn,
    queryFn: () => fetchUnreadCount(),
  });
  const hideNotices = !signedIn || (unread.error ? classifyEditError(unread.error) === "denied" : false);
  return (
    <div data-infra-app className="auth-access-root">
      <header className="auth-access-main auth-access-header">
        <p className="auth-access-kicker">{kicker}</p>
        <nav className="auth-access-nav" aria-label="Staff workspace">
          <ul className="auth-access-nav-list">
            {NAV.filter((item) => item.href !== "/notifications" || !hideNotices).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    navCurrent(pathname, item.href) ? "auth-access-nav-link is-active" : "auth-access-nav-link"
                  }
                  aria-current={navCurrent(pathname, item.href) ? "page" : undefined}
                >
                  {item.label}
                  {item.href === "/notifications" && typeof unread.data === "number" ? (
                    <span aria-live="polite"> {unread.data}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <h1 className="auth-access-title">{title}</h1>
        {description ? <p className="auth-access-copy">{description}</p> : null}
      </header>
      <div className={wide ? "auth-access-main is-wide" : "auth-access-main"}>{children}</div>
    </div>
  );
}
