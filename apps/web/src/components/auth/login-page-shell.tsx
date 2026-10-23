import Link from "next/link";

import "@/styles/auth-login.css";

import { getAuthLoginCopy } from "@/lib/auth/messages";
import { loginPathForLocale } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";
import { PUBLIC_LOCALE_NAV_ORDER, PUBLIC_LOCALE_LABELS } from "@/lib/landing/locales";

import { LoginForm } from "./login-form";

function AuthLoginBrandMark() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="28" height="28" rx="8" fill="#1f2937" />
      <path
        d="M10 18h8M18 18h8"
        stroke="var(--infra-orange, #ff5b00)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="18" r="4" fill="var(--infra-orange, #ff5b00)" />
      <circle cx="18" cy="18" r="6" stroke="rgb(255 91 0 / 35%)" strokeWidth="1" />
    </svg>
  );
}

type LoginPageShellProps = {
  locale: AuthLocale;
  nextParam?: string | null;
};

export function LoginPageShell({ locale, nextParam }: LoginPageShellProps) {
  const copy = getAuthLoginCopy(locale);

  return (
    <div data-infra-app className="auth-login-root min-h-dvh">
    <div className="auth-login-grid">
      <aside className="auth-login-corridor" aria-label="INFRAOS infrastructure coordination">
        <svg
          className="auth-login-corridor__schematic"
          viewBox="0 0 800 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="auth-grid-fade" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF5B00" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#279541" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          <rect width="800" height="800" fill="url(#auth-grid-fade)" />
          {[120, 240, 360, 480, 600].map((y) => (
            <line
              key={`h-${y}`}
              x1="40"
              y1={y}
              x2="760"
              y2={y}
              stroke="rgba(255,91,0,0.35)"
              strokeWidth="1"
            />
          ))}
          {[160, 320, 480, 640].map((x) => (
            <line
              key={`v-${x}`}
              x1={x}
              y1="80"
              x2={x}
              y2="720"
              stroke="rgba(255,91,0,0.22)"
              strokeWidth="1"
            />
          ))}
          {[
            [160, 240],
            [320, 360],
            [480, 480],
            [640, 600],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill="#FF5B00" />
          ))}
        </svg>
        <div className="relative z-10 max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <AuthLoginBrandMark />
            <span className="text-xl font-semibold tracking-tight">INFRAOS</span>
          </div>
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
            {copy.corridorTagline}
          </p>
          <p className="text-lg leading-relaxed text-slate-200">{copy.corridorBody}</p>
        </div>
        <p className="relative z-10 text-xs text-slate-500">{copy.subtitle}</p>
      </aside>

      <div className="auth-login-panel">
        <div className="auth-login-form-wrap">
          <header className="mb-8">
            <h1 className="auth-login-title">{copy.title}</h1>
            <p className="auth-login-subtitle">{copy.subtitle}</p>
            <nav
              className="mt-4 flex flex-wrap gap-3 text-sm"
              aria-label="Sign-in language"
            >
              {PUBLIC_LOCALE_NAV_ORDER.map((item) => (
                <Link
                  key={item}
                  href={loginPathForLocale(item)}
                  className={
                    item === locale
                      ? "font-semibold text-[var(--infra-orange)]"
                      : "text-[var(--app-muted)] hover:text-[var(--app-text)]"
                  }
                  lang={item}
                >
                  {PUBLIC_LOCALE_LABELS[item]}
                </Link>
              ))}
            </nav>
          </header>
          <LoginForm locale={locale} nextParam={nextParam} />
        </div>
      </div>
    </div>
    </div>
  );
}
