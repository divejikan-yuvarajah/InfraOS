"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/common/brand-mark";
import { DataSourceBadge } from "@/components/common/civic-atlas-primitives";
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
    <div className="min-h-screen bg-[#f7f9fb] text-[#111827] flex flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-b-[#ff5b00] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="shrink-0" aria-label="INFRAOS Home">
              <BrandMark size={34} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`${prefix}/portal`}
                  className="text-base font-bold tracking-tight text-slate-900 sm:text-lg"
                >
                  {copy.brandTitle}
                </Link>
                <DataSourceBadge kind="live" label="Public Release" />
              </div>
              <p className="truncate text-xs text-slate-600">{copy.brandSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav
              aria-label="Public portal navigation"
              className="flex flex-wrap items-center gap-1"
            >
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                      isActive
                        ? "bg-[#c43d00] text-white shadow-2xs"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 text-xs">
              <Link
                href="/portal"
                className={`rounded px-2 py-1 font-semibold ${
                  locale === "en"
                    ? "bg-[#111827] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                EN
              </Link>
              <Link
                href="/si/portal"
                className={`rounded px-2 py-1 font-semibold ${
                  locale === "si"
                    ? "bg-[#111827] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                සිං
              </Link>
              <Link
                href="/ta/portal"
                className={`rounded px-2 py-1 font-semibold ${
                  locale === "ta"
                    ? "bg-[#111827] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                த
              </Link>
            </div>

            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              {copy.navStaffSignIn}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
