import { BrandMark } from "@/components/common/brand-mark";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  Compass,
  Eye,
  Flag,
  GitCompareArrows,
  Scale,
} from "lucide-react";

import "@/styles/auth-login.css";

import { lpFontClass } from "@/components/landing/lp/lp-fonts";
import { getAuthLoginCopy } from "@/lib/auth/messages";
import type { AuthLocale } from "@/lib/auth/types";
import { publicInfoPath } from "@/lib/landing/locales";

import { AuthPanelNav, TopAuthBar } from "./top-auth-bar";

type AuthStitchFrameProps = {
  locale: AuthLocale;
  localeHrefFor: (locale: AuthLocale) => string;
  variant?: "login" | "register" | "recovery";
  children: ReactNode;
};

const LOGIN_SURVEY_TICKS = [
  "0+000",
  "0+500",
  "1+000",
  "1+500",
  "2+000",
  "2+500",
  "3+000",
  "3+500",
] as const;

const SIGNUP_CORRIDOR_COPY: Record<
  AuthLocale,
  {
    headlineLead: string;
    headlineAccent: string;
    subtitle: string;
    pins: readonly [string, string, string];
    sectionTitle: string;
    cards: readonly [
      { code: string; title: string; desc: string },
      { code: string; title: string; desc: string },
      { code: string; title: string; desc: string },
    ];
    footerLeft: string;
  }
> = {
  en: {
    headlineLead: "Build Better Infrastructure.",
    headlineAccent: "Together.",
    subtitle:
      "Join a coordinated digital workspace designed to help authorized institutions manage infrastructure assets, resolve alignment conflicts, and maintain operational transparency across national public works.",
    pins: ["Coordinate", "Monitor", "Improve"],
    sectionTitle: "A CONNECTED INFRASTRUCTURE WORKSPACE",
    cards: [
      {
        code: "01 — SYNC",
        title: "Cross-Agency",
        desc: "Eliminate repeated excavations",
      },
      {
        code: "02 — VERIFY",
        title: "Audit Trail",
        desc: "Immutable permit history",
      },
      {
        code: "03 — RESOLVE",
        title: "Early Conflict",
        desc: "Geospatial corridor alerts",
      },
    ],
    footerLeft: "Connecting institutions. Coordinating progress.",
  },
  si: {
    headlineLead: "වඩා හොඳ යටිතල පහසුකම් ගොඩනඟමු.",
    headlineAccent: "එක්ව.",
    subtitle:
      "ජාතික පොදු සංවර්ධන ව්‍යාපෘතිවල වත්කම් කළමනාකරණය, අවකාශීය ගැටුම් නිරාකරණය සහ මෙහෙයුම් විනිවිදභාවය පවත්වා ගැනීම සඳහා බලයලත් ආයතන එක් කරන ඩිජිටල් වැඩබිම.",
    pins: ["සම්බන්ධීකරණය", "අධීක්ෂණය", "වැඩිදියුණු කිරීම"],
    sectionTitle: "සම්බන්ධිත යටිතල පහසුකම් වැඩබිම",
    cards: [
      {
        code: "01 — SYNC",
        title: "අන්තර්-ආයතනික",
        desc: "නැවත නැවත මාර්ග කැණීම් වළක්වයි",
      },
      {
        code: "02 — VERIFY",
        title: "විගණන සටහන්",
        desc: "වෙනස් කළ නොහැකි බලපත්‍ර ඉතිහාසය",
      },
      {
        code: "03 — RESOLVE",
        title: "කල්තියා හඳුනාගැනීම",
        desc: "භූ-අවකාශීය කොරිඩෝ අනතුරු ඇඟවීම්",
      },
    ],
    footerLeft: "ආයතන යා කරමින්. ප්‍රගතිය සම්බන්ධීකරණය කරමින්.",
  },
  ta: {
    headlineLead: "சிறந்த உள்கட்டமைப்பை உருவாக்குவோம்.",
    headlineAccent: "இணைந்து.",
    subtitle:
      "தேசிய பொதுப் பணிகளில் உள்கட்டமைப்பு சொத்துக்களை நிர்வகிக்கவும், இடஞ்சார்ந்த மோதல்களைத் தீர்க்கவும், வெளிப்படைத்தன்மையைப் பேணவும் அங்கீகரிக்கப்பட்ட நிறுவனங்களுக்கான ஒருங்கிணைந்த தளம்.",
    pins: ["ஒருங்கிணைப்பு", "கண்காணிப்பு", "மேம்பாடு"],
    sectionTitle: "இணைக்கப்பட்ட உள்கட்டமைப்பு பணியிடம்",
    cards: [
      {
        code: "01 — SYNC",
        title: "நிறுவன ஒத்திசைவு",
        desc: "மீண்டும் மீண்டும் சாலை தோண்டுவதைத் தவிர்க்கும்",
      },
      {
        code: "02 — VERIFY",
        title: "தணிக்கை தடம்",
        desc: "மாற்ற முடியாத அனுமதி வரலாறு",
      },
      {
        code: "03 — RESOLVE",
        title: "முன்கூட்டிய தீர்வு",
        desc: "புவியியல் வழித்தட எச்சரிக்கைகள்",
      },
    ],
    footerLeft: "நிறுவனங்களை இணைக்கிறது. முன்னேற்றத்தை ஒருங்கிணைக்கிறது.",
  },
};

export function AuthStitchFrame({
  locale,
  localeHrefFor,
  variant = "login",
  children,
}: AuthStitchFrameProps) {
  const copy = getAuthLoginCopy(locale);
  const signupCorridor = SIGNUP_CORRIDOR_COPY[locale];
  const privacyHref = publicInfoPath(locale, "privacy");
  const accessibilityHref = publicInfoPath(locale, "accessibility");

  const pillarIcons = [Eye, GitCompareArrows, Activity] as const;
  const isRegister = variant === "register";

  return (
    <div data-infra-app className={`auth-login-root ${lpFontClass}`}>
      {/* Sign Up carries a header bar; Sign In starts directly with the split canvas */}
      {isRegister ? (
        <TopAuthBar
          locale={locale}
          localeHrefFor={localeHrefFor}
          backLabel={copy.backHome}
        />
      ) : null}

      {/* Main 100dvh Split-Screen Workspace */}
      <div className="auth-workspace">
        {/* LEFT PANEL: "The Field" — Documentary Engineering & Spatial HUD */}
        <aside
          className="auth-login-corridor auth-topo-bg"
          aria-label="InfraOS National Infrastructure Intelligence"
        >
          {/* Watermark Topographic Contour Background (Inline SVG) */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
            viewBox="0 0 700 900"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M-100 150 C120 180, 240 80, 520 190 C680 250, 750 170, 850 200"
              stroke="#CBD5E1"
              strokeDasharray="3 3"
              strokeWidth="1.2"
            />
            <path
              d="M-50 290 C180 340, 260 210, 580 310 C700 370, 760 290, 880 320"
              stroke="#CBD5E1"
              strokeWidth="1"
            />
            <path
              d="M-80 430 C150 490, 310 360, 620 460 C730 520, 800 440, 920 470"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />
            <circle
              cx="210"
              cy="380"
              r="140"
              stroke="#CBD5E1"
              strokeDasharray="2 4"
              strokeWidth="0.75"
            />
          </svg>

          {isRegister ? (
            <>
              {/* SIGN UP LEFT PANEL: Build Better Infrastructure. Together. */}
              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-2.5">
                  <BrandMark size={36} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="auth-stitch-serif text-base font-bold uppercase tracking-tight text-slate-900">
                        InfraOS
                      </span>
                      <span className="auth-stitch-mono rounded bg-[#FFDBCE] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#802A00]">
                        CIVIC CORE
                      </span>
                    </div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                      National Infrastructure Intelligence &amp; Coordination Platform
                    </p>
                  </div>
                </div>

                <div className="pt-1">
                  <h2 className="auth-stitch-serif text-[clamp(1.9rem,3.6vh+0.5rem,3.1rem)] font-semibold leading-[1.08] tracking-tight text-slate-900">
                    {signupCorridor.headlineLead}
                    <br />
                    <span className="relative inline-block italic text-slate-900">
                      {signupCorridor.headlineAccent}
                      <svg
                        className="absolute -bottom-1 left-0 h-1.5 w-full text-[#FF5B00]"
                        viewBox="0 0 100 8"
                        preserveAspectRatio="none"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M0,5 Q50,0 100,5"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </h2>
                  <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-600">
                    {signupCorridor.subtitle}
                  </p>
                </div>
              </div>

              {/* Field Survey Photograph with Total Station & Route Alignment */}
              <div className="auth-plate relative z-10 my-2 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md">
                <div className="auth-corridor-plate-media">
                  <Image
                    src="/landing/lp/qa-inspection.jpg"
                    alt="Sri Lankan civil engineers operating a digital total station theodolite on a highway corridor"
                    fill
                    sizes="(min-width: 1024px) 520px, 100vw"
                    className="object-cover object-center"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />

                  {/* Route Alignment Vector Overlay */}
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 400 240"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M 10 200 C 120 180, 200 130, 390 70"
                      stroke="#FF5B00"
                      strokeWidth="2.5"
                      strokeDasharray="4 3"
                      opacity="0.9"
                    />
                    <circle
                      cx="80"
                      cy="186"
                      r="4"
                      fill="#FFFFFF"
                      stroke="#FF5B00"
                      strokeWidth="2"
                    />
                    <circle
                      cx="210"
                      cy="126"
                      r="4"
                      fill="#FFFFFF"
                      stroke="#FF5B00"
                      strokeWidth="2"
                    />
                    <circle
                      cx="330"
                      cy="88"
                      r="4"
                      fill="#FFFFFF"
                      stroke="#FF5B00"
                      strokeWidth="2"
                    />
                  </svg>

                  {/* Top-Right Chainage Badge */}
                  <div className="auth-stitch-mono absolute top-2.5 right-2.5 rounded bg-slate-900/80 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-widest text-white backdrop-blur-xs">
                    STA: 04+200.00 KM
                  </div>

                  {/* Bottom Floating Civic Data Tag Pins */}
                  <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-900 shadow-xs backdrop-blur-xs">
                      <span className="h-2 w-2 rounded-full bg-[#FF5B00]" />
                      {signupCorridor.pins[0]}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-900 shadow-xs backdrop-blur-xs">
                      <span className="h-2 w-2 rounded-full bg-[#FEB600]" />
                      {signupCorridor.pins[1]}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-900 shadow-xs backdrop-blur-xs">
                      <span className="h-2 w-2 rounded-full bg-[#279541]" />
                      {signupCorridor.pins[2]}
                    </span>
                  </div>
                </div>

                {/* Photo Metadata Caption */}
                <div className="auth-stitch-mono flex items-center justify-between border-t border-slate-200 bg-white px-3.5 py-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1.5 truncate">
                    <Compass
                      className="h-3.5 w-3.5 shrink-0 text-[#FF5B00]"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      Fig. 2.4 — Sri Lanka National Infrastructure Coordination Alignment
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-slate-700">
                    GOSL-SURV-2025
                  </span>
                </div>
              </div>

              {/* 3 Statutory Value Cards (01 - SYNC, 02 - VERIFY, 03 - RESOLVE) */}
              <div className="relative z-10 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {signupCorridor.sectionTitle}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {signupCorridor.cards.map((card) => (
                    <div
                      key={card.code}
                      className="flex flex-col justify-between rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-2xs"
                    >
                      <span className="auth-stitch-mono text-[10px] font-bold text-[#FF5B00]">
                        {card.code}
                      </span>
                      <span className="mt-0.5 text-xs font-semibold text-slate-900">
                        {card.title}
                      </span>
                      <span className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
                        {card.desc}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-[10.5px] font-semibold text-slate-500">
                  <span className="truncate">{signupCorridor.footerLeft}</span>
                  <span className="auth-stitch-mono shrink-0 text-[9.5px] text-slate-500">
                    ISO 19650-COMPLIANT
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* SIGN IN LEFT PANEL: One Nation. Connected Infrastructure. */}
              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-2.5">
                  <BrandMark size={36} />
                  <div className="flex items-baseline gap-2">
                    <span className="auth-stitch-serif text-lg font-semibold tracking-tight text-slate-900">
                      InfraOS
                    </span>
                    <span className="auth-stitch-mono text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                      SL-NIP
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-0.5 text-[10.5px] font-semibold text-slate-600 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#279541]" />
                  <span>
                    National Infrastructure Intelligence &amp; Coordination Platform
                  </span>
                </div>

                <div>
                  <h2 className="auth-stitch-serif text-[clamp(1.6rem,2.4vh+0.65rem,2.2rem)] font-semibold leading-[1.1] tracking-tight text-slate-900">
                    {copy.corridorHeadlineLead}{" "}
                    <span className="relative inline-block italic text-slate-900">
                      {copy.corridorHeadlineAccent}
                      <svg
                        className="absolute -bottom-1 left-0 h-2 w-full text-[#FF5B00]"
                        viewBox="0 0 100 12"
                        preserveAspectRatio="none"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M0,9 Q50,-1 100,7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>{" "}
                    <span>{copy.corridorHeadlineTail}</span>
                  </h2>
                  <p className="mt-1.5 max-w-lg text-xs leading-snug text-slate-600">
                    {copy.corridorDescription}
                  </p>
                </div>
              </div>

              {/* Documentary Highway Photograph with Interactive Survey Leader Points */}
              <div className="auth-plate relative z-10 my-2 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-md">
                <div className="auth-corridor-plate-media">
                  <Image
                    src="/landing/lp/aerial-highway.jpg"
                    alt="Southern Expressway & Kadawatha Interchange corridor"
                    fill
                    sizes="(min-width: 1024px) 540px, 100vw"
                    className="object-cover object-center"
                    priority
                  />
                  {/* Vector Survey Lines */}
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-45"
                    viewBox="0 0 540 320"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M 40,280 C 140,240 220,180 340,110 C 420,60 480,40 520,30"
                      stroke="#FFFFFF"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 80,310 C 190,260 290,200 410,130 C 470,90 510,60 540,50"
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* 3 Floating Glass Telemetry Pins */}
                  <div className="absolute top-1/5 left-6 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-900 shadow-xs backdrop-blur-xs">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF5B00]" />
                    <span>{copy.corridorFlowSteps[0]}</span>
                  </div>

                  <div className="absolute bottom-1/3 left-1/3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-900 shadow-xs backdrop-blur-xs">
                    <span className="h-2 w-2 rounded-full bg-[#FEB600]" />
                    <span>{copy.corridorFlowSteps[1]}</span>
                  </div>

                  <div className="absolute top-1/2 right-6 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-900 shadow-xs backdrop-blur-xs">
                    <span className="h-2 w-2 rounded-full bg-[#279541]" />
                    <span>{copy.corridorFlowSteps[2]}</span>
                    <span className="h-2 w-2 rounded-full bg-[#FF5B00] ring-3 ring-[#FF5B00]/25" />
                  </div>

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />

                  {/* Bottom Datum & Chainage Readout */}
                  <div className="auth-stitch-mono absolute right-3 bottom-2.5 left-3 flex items-center justify-between text-[9.5px] tracking-wider text-white">
                    <span className="rounded bg-slate-900/75 px-2 py-0.5">
                      CAD.CH: 0+840 — 2+420
                    </span>
                    <span className="rounded bg-slate-900/75 px-2 py-0.5">
                      SRI LANKA DATUM 1999 (SLD99)
                    </span>
                  </div>
                </div>

                {/* Editorial Plate Caption */}
                <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2">
                  <span className="auth-stitch-mono truncate text-[10px] text-slate-500">
                    Plate 1.0 — Southern Expressway &amp; Kadawatha Interchange corridor • Sri Lanka National Road Network
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#A83900]">
                    GIS Synchronized
                  </span>
                </div>
              </div>

              {/* 3 Capability Pillars + Bottom System Flow Strip */}
              <div className="relative z-10 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {copy.corridorPillars.map((pillar, index) => {
                    const Icon = pillarIcons[index] ?? Eye;
                    return (
                      <div
                        key={pillar.title}
                        className="rounded-xl border border-white/90 bg-white/85 p-2.5 shadow-2xs backdrop-blur-md"
                      >
                        <div className="mb-1 flex items-center gap-1.5 text-[#A83900]">
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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

                {/* System Flow Strip */}
                <div className="flex items-center justify-between rounded-xl bg-[#ECEEF0] px-3 py-1.5 text-[10.5px] font-semibold text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF5B00]" />
                    <span>RDA</span>
                    <span className="text-slate-400">→</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FEB600]" />
                    <span>NWSDB &amp; CEB</span>
                    <span className="text-slate-400">→</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#279541]" />
                    <span>UDA Coordinated</span>
                  </div>
                  <span className="auth-stitch-mono text-[10px] text-slate-500">
                    InfraOS v4.2 Statutory Gateway
                  </span>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* CENTER DIVIDER: Signature Survey Line & Chainage Ruler */}
        <div className="auth-survey-ruler" aria-hidden="true">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200" />

          {/* Dynamic Signature Survey Line SVG */}
          <svg
            className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
            viewBox="0 0 44 700"
            preserveAspectRatio="none"
          >
            <path
              d="M -45 310 L 22 340 L 22 515 L 48 515"
              fill="none"
              stroke="#FF5B00"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="22" cy="425" r="3.5" fill="#FF5B00" />
          </svg>

          {isRegister ? (
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-between py-2 font-mono text-[9px] text-slate-500">
              <div className="flex flex-col items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-[#FF5B00] bg-white" />
                <span className="font-bold tracking-wider [writing-mode:vertical-rl] rotate-180">
                  0+000
                </span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="h-px w-2.5 bg-slate-300" />
                <span className="h-px w-1.5 bg-slate-300" />
                <span className="h-px w-2.5 bg-slate-300" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-bold tracking-wider text-[#FF5B00] [writing-mode:vertical-rl] rotate-180">
                  0+500
                </span>
                <span className="h-2 w-2 rounded-full bg-[#FF5B00]" />
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="h-px w-2.5 bg-slate-300" />
                <span className="h-px w-1.5 bg-slate-300" />
                <span className="h-px w-2.5 bg-slate-300" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="font-bold tracking-wider [writing-mode:vertical-rl] rotate-180">
                  1+000
                </span>
                <Flag className="h-3 w-3 text-[#279541]" />
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-between py-2 text-center font-mono text-[9px] text-slate-500">
              {LOGIN_SURVEY_TICKS.map((tick, idx) => (
                <div key={tick} className="flex flex-col items-center">
                  <span className="mb-0.5 h-px w-2 bg-slate-300" />
                  <span
                    className={
                      idx === 3 || idx === 4
                        ? "font-semibold text-[#C43D00]"
                        : "text-slate-400"
                    }
                  >
                    {tick}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: "The Entrance" — Active Form & Statutory Footnote */}
        <section className="auth-login-panel">
          {/* Back link + trilingual pill heading the entrance panel */}
          {!isRegister ? (
            <div className="mb-3 lg:mb-0">
              <AuthPanelNav
                locale={locale}
                localeHrefFor={localeHrefFor}
                backLabel={copy.backHome}
              />
            </div>
          ) : null}

          {/* Mobile Corridor Telemetry Plate (< 1024px, Sign In & Recovery) */}
          {!isRegister ? (
            <div className="mb-3 space-y-2.5 lg:hidden">
              <div className="flex items-center justify-between px-0.5">
                <div>
                  <p className="auth-stitch-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    GOV.LK DIGITAL • SL-NIP CORRIDOR
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#279541]" />
                  <span className="auth-stitch-mono text-[9.5px] font-bold uppercase tracking-widest text-slate-600">
                    Corridor Live
                  </span>
                </div>
              </div>

              <div className="relative h-[132px] w-full overflow-hidden rounded-2xl bg-slate-900 shadow-xs">
                <Image
                  src="/landing/lp/aerial-highway.jpg"
                  alt="Aerial documentary photograph of a highway interchange corridor in suburban Colombo"
                  fill
                  sizes="100vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
                {/* Cadastral Contour Lines Overlay */}
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
                  preserveAspectRatio="none"
                  viewBox="0 0 360 142"
                  aria-hidden="true"
                >
                  <path
                    d="M0,35 Q90,50 180,20 T360,45"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeDasharray="3,3"
                    strokeWidth="0.8"
                  />
                  <path
                    d="M0,85 Q110,60 220,95 T360,70"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeDasharray="4,2"
                    strokeWidth="0.8"
                  />
                  <line
                    stroke="#FF5B00"
                    strokeOpacity="0.7"
                    strokeWidth="1.2"
                    x1="28"
                    x2="28"
                    y1="0"
                    y2="142"
                  />
                </svg>
                <div className="absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#279541]" />
                    Corridor WP-A1 • National Highway Spine
                  </span>
                </div>
                <div className="absolute right-3 bottom-2.5 left-3 flex items-end justify-between text-white">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF5B00] ring-4 ring-[#FF5B00]/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    <span className="text-[11px] font-semibold tracking-tight text-white">
                      Datum 0+000 Datum Pin (RDA)
                    </span>
                  </div>
                  <span className="auth-stitch-mono text-[9.5px] font-semibold tracking-widest text-slate-200 uppercase">
                    Verified Grid
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Centered Form Slot with Mobile Left Survey Line Axis on Login */}
          <div
            className={
              isRegister
                ? "auth-register-form-wrap my-auto"
                : "auth-login-form-wrap relative my-auto"
            }
          >
            {!isRegister ? (
              <div className="relative pl-9 lg:pl-0">
                {/* Mobile Left-Edge Signature Orange Survey Line Axis (0+000 -> 0+150 -> 0+300 -> 0+500) */}
                <aside
                  className="absolute top-1 bottom-3 left-0 flex w-8 flex-col items-center select-none lg:hidden"
                  aria-hidden="true"
                >
                  <div className="absolute top-0 bottom-5 left-1/2 w-[2px] -translate-x-1/2 bg-[#FF5B00]/30" />
                  <div className="absolute top-0 left-1/2 h-24 w-[2px] -translate-x-1/2 bg-gradient-to-b from-[#FF5B00] to-transparent" />
                  <div className="auth-stitch-mono relative z-10 flex h-full flex-col items-center justify-between pt-2 pb-5 text-[8px] text-slate-500">
                    <div className="flex items-center gap-0.5">
                      <span className="h-px w-1.5 bg-[#FF5B00]" />
                      <span className="font-bold text-[#A83900]">0+000</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="h-px w-1 bg-slate-300" />
                      <span>0+150</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="h-px w-1 bg-slate-300" />
                      <span>0+300</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#FF5B00] ring-2 ring-[#FF5B00]/25">
                        <span className="h-1 w-1 rounded-full bg-white" />
                      </span>
                      <span className="font-bold text-[#A83900]">0+500</span>
                    </div>
                  </div>
                </aside>

                <div className="auth-liquid-card">{children}</div>
              </div>
            ) : (
              <div className="auth-liquid-card">{children}</div>
            )}
          </div>

          {/* Statutory Gazette & Computer Crimes Act Legal Footnote */}
          <footer className="mt-2 border-t border-slate-200/80 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500 lg:flex-nowrap">
              <div className="flex min-w-0 items-center gap-1.5">
                <Scale
                  className="h-3.5 w-3.5 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span className="truncate font-medium text-slate-600">
                  Access restricted under Extraordinary Gazette No. 2341/14 &amp; Computer Crimes Act No. 24 of 2007.
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[10.5px] font-semibold text-slate-500">
                <Link
                  href={privacyHref}
                  className="transition-colors hover:text-slate-900 hover:underline"
                >
                  {copy.dataProtocolLabel}
                </Link>
                <span aria-hidden="true">•</span>
                <Link
                  href={accessibilityHref}
                  className="transition-colors hover:text-slate-900 hover:underline"
                >
                  {copy.auditRegisterLabel}
                </Link>
                <span aria-hidden="true">•</span>
                <span className="auth-stitch-mono text-[10px] text-slate-600">
                  {copy.helplineLabel}
                </span>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
