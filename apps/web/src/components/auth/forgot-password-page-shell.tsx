import Link from "next/link";

import "@/styles/auth-login.css";

import { getAuthForgotCopy } from "@/lib/auth/messages";
import { forgotPasswordPathForLocale } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";
import { PUBLIC_LOCALE_LABELS, PUBLIC_LOCALE_NAV_ORDER } from "@/lib/landing/locales";

import { ForgotPasswordForm } from "./forgot-password-form";

type ForgotPasswordPageShellProps = {
  locale: AuthLocale;
};

export function ForgotPasswordPageShell({ locale }: ForgotPasswordPageShellProps) {
  const copy = getAuthForgotCopy(locale);
  return (
    <div data-infra-app className="auth-login-root min-h-dvh">
      <div className="auth-login-grid">
        <aside className="auth-login-corridor" aria-label="INFRAOS infrastructure coordination">
          <div className="relative z-10 max-w-md space-y-4">
            <p className="text-xl font-semibold tracking-tight">INFRAOS</p>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Password recovery</p>
            <p className="text-lg leading-relaxed text-slate-200">{copy.subtitle}</p>
          </div>
        </aside>
        <div className="auth-login-panel">
          <div className="auth-login-form-wrap">
            <header className="mb-8">
              <h1 className="auth-login-title">{copy.title}</h1>
              <p className="auth-login-subtitle">{copy.subtitle}</p>
              <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Recovery language">
                {PUBLIC_LOCALE_NAV_ORDER.map((item) => (
                  <Link
                    key={item}
                    href={forgotPasswordPathForLocale(item)}
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
            <ForgotPasswordForm locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}
