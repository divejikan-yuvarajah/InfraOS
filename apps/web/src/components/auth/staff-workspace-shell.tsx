"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Workspace" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
] as const;

export function StaffWorkspaceShell({
  kicker = "INFRAOS",
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
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
                    pathname === item.href ? "auth-access-nav-link is-active" : "auth-access-nav-link"
                  }
                  aria-current={pathname === item.href ? "page" : undefined}
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
      <div className="auth-access-main">{children}</div>
    </div>
  );
}
