import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Compass,
  Eye,
  GitCompareArrows,
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
      {/* Slim Top Institutional Utility Bar */}
      <header className="w-full shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2.5 py-1.5 sm:px-6 lg:px-8">
          <Link
            href={homeHref}
            className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-600 transition-colors hover:text-[#C43D00]"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{copy.backHome}</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-5">
            <nav
              aria-label="Authentication language selector"
              className="flex items-center gap-0.5 text-[11px] sm:gap-1 sm:text-xs"
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

            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-0.5 text-[10.5px] font-medium text-[#279541] sm:inline-flex">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>{copy.officialAccessBadge}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Centered Split-Screen Card */}
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col justify-center px-2.5 py-1.5 sm:px-5 sm:py-2.5 lg:px-8">
        {/* Mobile Compact Aerial Corridor Banner (< 1024px) */}
        <div className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-white shadow-xs lg:hidden">
          <div className="relative h-20 w-full overflow-hidden">
            <Image
              src="/landing/lp/aerial-highway.jpg"
              alt="Southern Expressway & Kadawatha Interchange corridor"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center opacity-65"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-900/30" />
            <div className="relative z-10 flex h-full flex-col justify-between p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded bg-white/95 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#279541]" />
                  LIVE GIS SYNC
                </span>
                <span className="auth-stitch-mono text-[9.5px] text-slate-200">
                  6.9271° N, 79.8612° E
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="auth-stitch-serif text-sm font-semibold leading-tight text-white">
                  Zero Spatial Clashes Active
                </p>
                <p className="auth-stitch-mono text-[9px] uppercase tracking-wider text-amber-300">
                  WP-A1 CORRIDOR
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
                d="M360 225 L 598 288"
                stroke="#FF5B00"
                strokeWidth="1.5"
                strokeOpacity="0.65"
              />
              <circle cx="360" cy="225" r="3.5" fill="#FF5B00" />
            </svg>

            {/* Center Vertical Survey Chainage Ruler (Desktop Edge) */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-9 flex-col items-end justify-between py-5 pr-1.5 lg:flex"
              aria-hidden="true"
            >
              {SURVEY_TICKS.map((tick, index) => (
                <div key={tick} className="flex flex-col items-end gap-0.5">
                  <span className="h-[1px] w-2 bg-slate-300" />
                  <span
                    className={`auth-stitch-mono text-[7.5px] tracking-tight ${
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
            <div className="relative z-10 space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF5B00] to-[#C43D00] text-white shadow-sm shadow-orange-950/15">
                  <svg
                    className="h-5 w-5"
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
                    <span className="auth-stitch-serif text-lg font-bold tracking-tight text-slate-900">
                      InfraOS
                    </span>
                    <span className="auth-stitch-mono rounded bg-slate-200/80 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-600">
                      NATIONAL GRID
                    </span>
                  </div>
                  <p className="text-[11px] font-medium leading-tight text-slate-600">
                    National Infrastructure Intelligence &amp; Coordination Platform
                  </p>
                </div>
              </div>

              {/* Spatial Sync Live Pill */}
              <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#279541]" />
                <span>{copy.corridorStatusPill}</span>
              </div>

              {/* Editorial Serif Headline */}
              <div>
                <h2 className="auth-stitch-serif text-[clamp(1.6rem,2.4vh+0.7rem,2.15rem)] font-bold leading-[1.08] tracking-tight text-slate-900">
                  {copy.corridorHeadlineLead}
                  <br />
                  <span className="relative inline-block italic text-[#C43D00]">
                    {copy.corridorHeadlineAccent}
                    <svg
                      className=" -bottom-0.5 left-0 h-1.5 w-full text-[#FF5B00]"
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
                <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-600">
                  {copy.corridorDescription}
                </p>
              </div>
            </div>

            {/* Middle Aerial Highway Plate + Flow Strip */}
            <div className="relative z-10 my-2.5 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
              <div className="auth-corridor-plate-media">
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
                <div className="absolute top-2 right-2 left-2 flex flex-wrap items-center justify-between gap-1">
                  <span className="auth-stitch-mono inline-flex items-center gap-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-100 backdrop-blur-xs">
                    <Compass className="h-2.5 w-2.5 text-[#FF5B00]" aria-hidden="true" />
                    06°55&apos;55.2&quot;N 79°52&apos;52.8&quot;E | CH: +4.200
                  </span>
                  <span className="auth-stitch-mono rounded bg-[#279541] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    {copy.corridorBadgeStatus}
                  </span>
                </div>

                {/* Bottom Corridor Label */}
                <div className="absolute right-2 bottom-2 left-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-[#FF5B00] px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                      RDA Corridor #4
                    </span>
                    <span className="truncate text-[10.5px] font-medium text-white">
                      Kadawatha - Mirigama Section
                    </span>
                  </div>
                  <span className="auth-stitch-mono hidden text-[9.5px] text-slate-200 xl:inline">
                    4 Utilities Synced
                  </span>
                </div>
              </div>

              {/* 3-Node Connected Flow Bar */}
              <div className="grid grid-cols-3 items-center divide-x divide-slate-100 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800">
                <div className="flex items-center gap-1.5 pr-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF5B00]" />
                  <span className="truncate leading-tight">{copy.corridorFlowSteps[0]}</span>
                </div>
                <div className="flex items-center gap-1.5 px-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FEB600]" />
                  <span className="truncate leading-tight">{copy.corridorFlowSteps[1]}</span>
                </div>
                <div className="flex items-center gap-1.5 pl-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#279541]" />
                  <span className="truncate leading-tight">{copy.corridorFlowSteps[2]}</span>
                </div>
              </div>
            </div>

            {/* 3 Feature Pillar Cards + Version Footer */}
            <div className="relative z-10 space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                {copy.corridorPillars.map((pillar, index) => {
                  const Icon = pillarIcons[index] ?? Eye;
                  return (
                    <div
                      key={pillar.title}
                      className="rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-2xs"
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <Icon
                          className="h-3.5 w-3.5 shrink-0 text-[#C43D00]"
                          aria-hidden="true"
                        />
                        <h3 className="text-[11px] font-bold text-slate-900">
                          {pillar.title}
                        </h3>
                      </div>
                      <p className="text-[10.5px] leading-snug text-slate-600">
                        {pillar.body}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-[10.5px] text-slate-500">
                <span className="truncate">{copy.corridorFooter}</span>
                <span className="auth-stitch-mono shrink-0 text-[9.5px] font-semibold text-slate-400">
                  VER 2.4.9-LK
                </span>
              </div>
            </div>
          </aside>

          {/* RIGHT PANEL: Active Authentication / Registration Form */}
          <div className="auth-login-panel">
            {/* Form Slot */}
            <div
              className={
                variant === "register"
                  ? "auth-register-form-wrap my-auto"
                  : "auth-login-form-wrap my-auto"
              }
            >
              {children}
            </div>

            {/* Bottom Security Reassurance & Institutional Links Bar */}
            <div className="mt-2 border-t border-slate-100 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 text-[#279541]"
                    aria-hidden="true"
                  />
                  <span>{copy.securityFooterText}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[10.5px] font-medium text-slate-500">
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
                  <span className="auth-stitch-mono text-[10px] text-slate-600">
                    {copy.helplineLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
