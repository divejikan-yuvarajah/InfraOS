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

/** Segmented English / සිංහල / தமிழ் switcher used inside the form panel. */
export function AuthLocalePill({
  locale,
  localeHrefFor,
}: Pick<TopAuthBarProps, "locale" | "localeHrefFor">) {
  return (
    <nav
      aria-label="Authentication language selector"
      className="inline-flex shrink-0 items-center rounded-full bg-[#F2F4F6] p-0.5 shadow-2xs"
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
                ? "relative rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-2xs"
                : "rounded-full px-3 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:text-slate-900"
            }
          >
            <span>{PUBLIC_LOCALE_LABELS[item]}</span>
            {active ? (
              <span
                className="absolute right-3 bottom-0.5 left-3 h-0.5 rounded-full bg-[#FF5B00]"
                aria-hidden="true"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Back link + locale pill row that heads the form panel (Sign In & recovery). */
export function AuthPanelNav({
  locale,
  localeHrefFor,
  backLabel,
}: Pick<TopAuthBarProps, "locale" | "localeHrefFor" | "backLabel">) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      <Link
        href={publicHomePath(locale)}
        className="inline-flex min-w-0 items-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#F2F4F6] hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{backLabel}</span>
      </Link>
      <AuthLocalePill locale={locale} localeHrefFor={localeHrefFor} />
    </div>
  );
}

/** Sign Up header bar: wordmark, directorate, portal assurance, language tabs. */
export function TopAuthBar({
  locale,
  localeHrefFor,
  subBadge = "NATIONAL INFRASTRUCTURE DIRECTORATE",
}: TopAuthBarProps) {
  return (
    <header className="auth-top-bar h-14 w-full shrink-0 border-b border-slate-200/70 bg-[#F8FAFC]">
      <div className="flex h-full w-full items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href={publicHomePath(locale)}
          className="flex min-w-0 items-center gap-3 text-slate-900"
        >
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 bg-[#FF5B00]" aria-hidden="true" />
            <span className="auth-stitch-serif text-xl font-semibold tracking-tight uppercase">
              InfraOS
            </span>
          </span>
          <span className="hidden h-5 w-px bg-slate-300 md:inline-block" aria-hidden="true" />
          <span className="hidden truncate text-[11px] font-semibold tracking-wider text-slate-600 uppercase md:inline">
            {subBadge}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-4 text-[11px] text-slate-600 sm:gap-6">
          <span className="hidden items-center gap-1.5 font-medium text-slate-700 lg:inline-flex">
            <ShieldCheck className="h-4 w-4 text-[#A83900]" aria-hidden="true" />
            Official Portal · GOSL Auth v4.2
          </span>
          <nav aria-label="Header language selector" className="flex items-center gap-2">
            {PUBLIC_LOCALE_NAV_ORDER.map((item, index) => {
              const active = item === locale;
              return (
                <span key={item} className="flex items-center gap-2">
                  {index > 0 ? (
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  <Link
                    href={localeHrefFor(item)}
                    lang={item}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "border-b-2 border-[#FF5B00] pb-0.5 font-semibold text-slate-900"
                        : "pb-0.5 transition-colors hover:text-slate-900"
                    }
                  >
                    {PUBLIC_LOCALE_LABELS[item]}
                  </Link>
                </span>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
