"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import { PORTAL_COPY } from "@/lib/public/messages";

function localePrefix(locale: AuthLocale): string {
  return locale === "en" ? "" : `/${locale}`;
}

export function PortalShell({
  locale,
  activeNav,
  children,
}: {
  locale: AuthLocale;
  activeNav: "portal" | "map" | "report" | "track";
  children: ReactNode;
}) {
  const copy = PORTAL_COPY[locale];
  const prefix = localePrefix(locale);

  const navItems = [
    { id: "portal" as const, href: `${prefix}/portal`, label: copy.navPortal },
    { id: "map" as const, href: "/portal/map", label: copy.navMap },
    { id: "report" as const, href: "/portal/report", label: copy.navReport },
    { id: "track" as const, href: "/portal/track", label: copy.navTrack },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <Link href={`${prefix}/portal`} className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              {copy.brandTitle}
            </Link>
            <p className="truncate text-xs text-slate-500">{copy.brandSubtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Public portal navigation" className="flex flex-wrap items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
                    activeNav === item.id
                      ? "bg-blue-700 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 text-xs">
              <Link href="/portal" className={`rounded px-2 py-1 ${locale === "en" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                EN
              </Link>
              <Link href="/si/portal" className={`rounded px-2 py-1 ${locale === "si" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                සිං
              </Link>
              <Link href="/ta/portal" className={`rounded px-2 py-1 ${locale === "ta" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                த
              </Link>
            </div>

            <Link
              href="/login"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {copy.navStaffSignIn}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
