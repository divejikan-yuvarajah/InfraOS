import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import type { AuthLocale } from "@/lib/auth/types";
import {
  PUBLIC_LOCALE_LABELS,
  PUBLIC_LOCALE_NAV_ORDER,
  publicHomePath,
} from "@/lib/landing/locales";

export type TopAuthBarProps = {
  locale: AuthLocale;
  localeHrefFor: (locale: AuthLocale) => string;
  backLabel: string;
  subBadge?: string;
};

export function TopAuthBar({
  locale,
  localeHrefFor,
  backLabel,
  subBadge = "SL-NIP CORRIDOR • NATIONAL INFRASTRUCTURE DIRECTORATE",
}: TopAuthBarProps) {
  const homeHref = publicHomePath(locale);

  return (
    <header className="auth-top-bar h-14 w-full shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        {/* Left: Brand Mark + Institutional Sub-Badge + Back to Portal */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-2 text-slate-900 transition-opacity hover:opacity-90"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#FF5B00] text-white shadow-xs">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="12" cy="18" r="2.5" />
                <path d="M8.5 6h7" />
                <path d="M7.5 8.2 10.8 15.8" />
                <path d="M16.5 8.2 13.2 15.8" />
              </svg>
            </span>
            <span className="auth-stitch-serif text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              InfraOS
            </span>
          </Link>

          <span
            className="hidden h-4 w-px bg-slate-200 md:inline-block"
            aria-hidden="true"
          />

          <span className="auth-stitch-mono hidden truncate rounded bg-[#FFDBCE]/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#802A00] xl:inline-block">
            CIVIC CORE
          </span>

          <span className="hidden truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:inline-block">
            {subBadge}
          </span>

          <span
            className="hidden h-4 w-px bg-slate-200 sm:inline-block"
            aria-hidden="true"
          />

          <Link
            href={homeHref}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-xs font-medium text-slate-600 transition-all hover:border-slate-200 hover:bg-slate-100/80 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{backLabel}</span>
          </Link>
        </div>

        {/* Right: TLS 1.3 FIPS Indicator + Trilingual Switcher */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-3 py-1 text-[11px] font-semibold text-slate-700 md:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#279541] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#279541]" />
            </span>
            <ShieldCheck
              className="h-3.5 w-3.5 text-[#279541]"
              aria-hidden="true"
            />
            <span className="auth-stitch-mono text-[10.5px] font-semibold text-slate-700">
              TLS 1.3 FIPS • GOSL Auth v4.2
            </span>
          </div>

          <nav
            aria-label="Authentication language selector"
            className="inline-flex items-center rounded-full border border-slate-200/90 bg-[#F2F4F6]/90 p-0.5 shadow-2xs backdrop-blur-md"
          >
            {PUBLIC_LOCALE_NAV_ORDER.map((item) => {
              const active = item === locale;
              return (
                <Link
                  key={item}
                  href={localeHrefFor(item)}
                  lang={item}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "relative rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-2xs sm:px-3"
                      : "rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:text-slate-900 sm:px-3"
                  }
                >
                  <span>{PUBLIC_LOCALE_LABELS[item]}</span>
                  {active ? (
                    <span
                      className="absolute right-2.5 bottom-0.5 left-2.5 h-0.5 rounded-full bg-[#FF5B00]"
                      aria-hidden="true"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

