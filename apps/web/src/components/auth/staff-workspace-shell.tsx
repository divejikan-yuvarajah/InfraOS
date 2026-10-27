"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Workspace" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/admin/users", label: "Staff" },
  { href: "/admin/agencies", label: "Agencies" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/projects", label: "Projects" },
  { href: "/projects/reviews", label: "Reviews" },
] as const;

function navCurrent(pathname: string, href: string): boolean {
  if (href === "/projects/reviews") return pathname === href || pathname.endsWith("/review");
  return pathname === href;
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
  return (
    <div data-infra-app className="auth-access-root">
      <header className="auth-access-main auth-access-header">
        <p className="auth-access-kicker">{kicker}</p>
        <nav className="auth-access-nav" aria-label="Staff workspace">
          <ul className="auth-access-nav-list">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    navCurrent(pathname, item.href) ? "auth-access-nav-link is-active" : "auth-access-nav-link"
                  }
                  aria-current={navCurrent(pathname, item.href) ? "page" : undefined}
                >
                  {item.label}
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
