import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Compass,
  Eye,
  GitCompareArrows,
  Globe,
  Lock,
  ShieldCheck,
} from "lucide-react";

import "@/styles/auth-login.css";

import { lpFontClass } from "@/components/landing/lp/lp-fonts";
import { getAuthLoginCopy } from "@/lib/auth/messages";
import type { AuthLocale } from "@/lib/auth/types";
import {
  PUBLIC_LOCALE_LABELS,
  PUBLIC_LOCALE_NAV_ORDER,
  publicHomePath,
  publicInfoPath,
} from "@/lib/landing/locales";

type AuthStitchFrameProps = {
  locale: AuthLocale;
  localeHrefFor: (locale: AuthLocale) => string;
  variant?: "login" | "register" | "recovery";
  children: ReactNode;
};

const SURVEY_TICKS = [
  "0+000",
  "0+500",
  "1+000",
  "1+500",
  "2+000",
  "2+500",
  "3+000",
  "3+500",
] as const;

export function AuthStitchFrame({
  locale,
  localeHrefFor,
  variant = "login",
  children,
}: AuthStitchFrameProps) {
  const copy = getAuthLoginCopy(locale);
  const homeHref = publicHomePath(locale);
  const privacyHref = publicInfoPath(locale, "privacy");
  const accessibilityHref = publicInfoPath(locale, "accessibility");

  const pillarIcons = [Eye, GitCompareArrows, ShieldCheck] as const;

  return (
    <div data-infra-app className={`auth-login-root ${lpFontClass}`}>
      {/* Top Institutional Utility Bar */}
      <header className="w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 transition-colors hover:text-[#C43D00]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.backHome}</span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            <nav
              aria-label="Authentication language selector"
              className="flex items-center gap-1 text-xs"
            >
              {PUBLIC_LOCALE_NAV_ORDER.map((item, idx) => {
                const active = item === locale;
                return (
                  <span key={item} className="inline-flex items-center">
                    {idx > 0 ? (
                      <span className="mx-1 text-slate-300" aria-hidden="true">
                        |
                      </span>
                    ) : null}
                    <Link
                      href={localeHrefFor(item)}
                      lang={item}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "border-b-2 border-[#FF5B00] px-1 py-0.5 font-semibold text-slate-900"
                          : "px-1 py-0.5 font-medium text-slate-500 transition-colors hover:text-slate-900"
                      }
                    >
                      {PUBLIC_LOCALE_LABELS[item]}
                    </Link>
                  </span>
                );
              })}
            </nav>

            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-medium text-[#279541] sm:inline-flex">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>{copy.officialAccessBadge}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Centered Split-Screen Card */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        {/* Mobile Compact Aerial Corridor Banner (< 1024px) */}
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-white shadow-sm lg:hidden">
          <div className="relative h-32 w-full overflow-hidden">
            <Image
              src="/landing/lp/aerial-highway.jpg"
              alt="Southern Expressway & Kadawatha Interchange corridor"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center opacity-65"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-900/30" />
            <div className="relative z-10 flex h-full flex-col justify-between p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#279541]" />
                  LIVE GIS SYNC
                </span>
                <span className="auth-stitch-mono text-[10px] text-slate-200">
                  6.9271° N, 79.8612° E
                </span>
              </div>
              <div>
                <p className="auth-stitch-mono text-[10px] uppercase tracking-wider text-amber-300">
                  CORRIDOR WP-A1 / SOUTHERN SPINE
                </p>
                <p className="auth-stitch-serif text-lg font-semibold leading-tight text-white">
                  Zero Spatial Clashes Active
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-login-grid">
          {/* LEFT PANEL: Infrastructure Branding & Spatial Intelligence Showcase */}
          <aside
            className="auth-login-corridor auth-topo-bg"
            aria-label="InfraOS National Infrastructure Intelligence"
          >
            {/* Subtle SVG Survey Contour & Vector Line */}
            <svg
              className="auth-login-corridor__schematic"
              viewBox="0 0 600 800"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M-40 160 C 140 180, 260 110, 440 190 S 580 310, 660 280"
                stroke="#CBD5E1"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <path
                d="M360 245 L 598 308"
                stroke="#FF5B00"
                strokeWidth="1.5"
                strokeOpacity="0.65"
              />
              <circle cx="360" cy="245" r="3.5" fill="#FF5B00" />
            </svg>

            {/* Center Vertical Survey Chainage Ruler (Desktop Edge) */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-10 flex-col items-end justify-between py-8 pr-1.5 lg:flex"
              aria-hidden="true"
            >
              {SURVEY_TICKS.map((tick, index) => (
                <div key={tick} className="flex flex-col items-end gap-0.5">
                  <span className="h-[1px] w-2 bg-slate-300" />
                  <span
                    className={`auth-stitch-mono text-[8px] tracking-tight ${
                      index === 2 || index === 4
                        ? "font-semibold text-[#C43D00]"
                        : "text-slate-400"
                    }`}
                  >
                    {tick}
                  </span>
                </div>
              ))}
            </div>

            {/* Top Brand Identity */}
            <div className="relative z-10 space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5B00] to-[#C43D00] text-white shadow-md shadow-orange-950/15">
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
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
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="auth-stitch-serif text-xl font-bold tracking-tight text-slate-900">
                      InfraOS
                    </span>
                    <span className="auth-stitch-mono rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      NATIONAL GRID
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-slate-600">
                    National Infrastructure Intelligence &amp; Coordination Platform
                  </p>
                </div>
              </div>

              {/* Spatial Sync Live Pill */}
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-[#279541]" />
                <span>{copy.corridorStatusPill}</span>
              </div>

              {/* Editorial Serif Headline */}
              <div>
                <h2 className="auth-stitch-serif text-[2.25rem] font-bold leading-[1.1] tracking-tight text-slate-900 xl:text-[2.5rem]">
                  {copy.corridorHeadlineLead}
                  <br />
                  <span className="relative inline-block italic text-[#C43D00]">
                    {copy.corridorHeadlineAccent}
                    <svg
                      className=" -bottom-1 left-0 h-2 w-full text-[#FF5B00]"
                      viewBox="0 0 180 8"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 5.5C48 2.2 118 1.8 178 4.8"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>{" "}
                  <span>{copy.corridorHeadlineTail}</span>
                </h2>
                <p className="mt-3.5 max-w-md text-[13.5px] leading-relaxed text-slate-600">
                  {copy.corridorDescription}
                </p>
              </div>
            </div>

            {/* Middle Aerial Highway Plate + Flow Strip */}
            <div className="relative z-10 my-5 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                <Image
                  src="/landing/lp/aerial-highway.jpg"
                  alt="Southern Expressway & Kadawatha Interchange corridor"
                  fill
                  sizes="(min-width: 1024px) 520px, 100vw"
                  className="object-cover object-center"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-slate-950/50" />

                {/* Top GIS Telemetry Bar */}
                <div className="absolute top-2.5 right-2.5 left-2.5 flex flex-wrap items-center justify-between gap-1.5">
                  <span className="auth-stitch-mono inline-flex items-center gap-1.5 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-100 backdrop-blur-xs">
                    <Compass className="h-3 w-3 text-[#FF5B00]" aria-hidden="true" />
                    06°55&apos;55.2&quot;N 79°52&apos;52.8&quot;E | CH: +4.200
                  </span>
                  <span className="auth-stitch-mono rounded bg-[#279541] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white">
                    {copy.corridorBadgeStatus}
                  </span>
                </div>

                {/* Bottom Corridor Label */}
                <div className="absolute right-2.5 bottom-2.5 left-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#FF5B00] px-2 py-0.5 text-[10px] font-bold text-white">
                      RDA Corridor #4
                    </span>
                    <span className=" truncate text-[11px] font-medium text-white">
                      Kadawatha - Mirigama Section
                    </span>
                  </div>
                  <span className="auth-stitch-mono hidden text-[10px] text-slate-200 xl:inline">
                    4 Utilities Synced
                  </span>
                </div>
              </div>

              {/* 3-Node Connected Flow Bar */}
              <div className="grid grid-cols-3 items-center divide-x divide-slate-100 bg-white px-3 py-2.5 text-[11.5px] font-semibold text-slate-800">
                <div className="flex items-center gap-2 pr-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF5B00]" />
                  <span className="leading-tight">{copy.corridorFlowSteps[0]}</span>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#FEB600]" />
                  <span className="leading-tight">{copy.corridorFlowSteps[1]}</span>
                </div>
                <div className="flex items-center gap-2 pl-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#279541]" />
                  <span className="leading-tight">{copy.corridorFlowSteps[2]}</span>
                </div>
              </div>
            </div>

            {/* 3 Feature Pillar Cards */}
            <div className="relative z-10 space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                {copy.corridorPillars.map((pillar, index) => {
                  const Icon = pillarIcons[index] ?? Eye;
                  return (
                    <div
                      key={pillar.title}
                      className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-2xs"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Icon
                          className="h-3.5 w-3.5 shrink-0 text-[#C43D00]"
                          aria-hidden="true"
                        />
                        <h3 className="text-xs font-bold text-slate-900">
                          {pillar.title}
                        </h3>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-600">
                        {pillar.body}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 text-[11px] text-slate-500">
                <span>{copy.corridorFooter}</span>
                <span className="auth-stitch-mono text-[10px] font-semibold text-slate-400">
                  VER 2.4.9-LK
                </span>
              </div>
            </div>
          </aside>

          {/* RIGHT PANEL: Active Authentication / Registration Form */}
          <div className="auth-login-panel">
            {/* Inner Panel Header: Language Switcher & Public Portal Link */}
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2 text-xs">
                <Globe className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <div className="flex items-center gap-1.5">
                  {PUBLIC_LOCALE_NAV_ORDER.map((item, index) => {
                    const active = item === locale;
                    return (
                      <span key={item} className="inline-flex items-center">
                        {index > 0 ? (
                          <span className="mx-1 text-slate-300" aria-hidden="true">
                            ·
                          </span>
                        ) : null}
                        <Link
                          href={localeHrefFor(item)}
                          lang={item}
                          className={
                            active
                              ? "border-b-2 border-[#FF5B00] pb-0.5 font-semibold text-slate-900"
                              : "pb-0.5 text-slate-500 transition-colors hover:text-slate-900"
                          }
                        >
                          {PUBLIC_LOCALE_LABELS[item]}
                        </Link>
                      </span>
                    );
                  })}
                </div>
              </div>

              <Link
                href={homeHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 transition-colors hover:text-[#C43D00]"
              >
                <span>{copy.backHome}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {/* Form Slot */}
            <div
              className={
                variant === "register"
                  ? "auth-register-form-wrap my-auto py-2"
                  : "auth-login-form-wrap my-auto py-2"
              }
            >
              {children}
            </div>

            {/* Bottom Security Reassurance Bar */}
            <div className="mt-8 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className="h-4 w-4 shrink-0 text-[#279541]"
                    aria-hidden="true"
                  />
                  <span>{copy.securityFooterText}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                  <Link
                    href={privacyHref}
                    className="transition-colors hover:text-slate-800"
                  >
                    {copy.dataProtocolLabel}
                  </Link>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={accessibilityHref}
                    className="transition-colors hover:text-slate-800"
                  >
                    {copy.auditRegisterLabel}
                  </Link>
                  <span aria-hidden="true">·</span>
                  <span className="auth-stitch-mono text-[10.5px] text-slate-600">
                    {copy.helplineLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page-Level Institutional Footer */}
      <footer className="w-full border-t border-slate-200/70 bg-white/70 py-3.5 text-[11px] text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-center sm:text-left">
            InfraOS: National Capital Works &amp; Inter-Agency Coordination Grid · Sovereign Digital Infrastructure
          </p>
          <div className="flex items-center gap-4">
            <Link href={privacyHref} className="hover:text-slate-800">
              Security &amp; Privacy Notice
            </Link>
            <span>·</span>
            <Link href={accessibilityHref} className="hover:text-slate-800">
              Accessibility
            </Link>
            <span>·</span>
            <span className="auth-stitch-mono">Incident Desk: 1919</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
