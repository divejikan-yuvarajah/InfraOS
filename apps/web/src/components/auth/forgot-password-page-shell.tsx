import { getAuthForgotCopy } from "@/lib/auth/messages";
import { forgotPasswordPathForLocale } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";

import { AuthStitchFrame } from "./auth-stitch-frame";
import { ForgotPasswordForm } from "./forgot-password-form";

type ForgotPasswordPageShellProps = {
  locale: AuthLocale;
};

export function ForgotPasswordPageShell({ locale }: ForgotPasswordPageShellProps) {
  const copy = getAuthForgotCopy(locale);
  return (
    <AuthStitchFrame
      locale={locale}
      localeHrefFor={(item) => forgotPasswordPathForLocale(item)}
      variant="recovery"
    >
      <header className="mb-3.5">
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200/90 bg-slate-100/90 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5B00]" />
          <span className="auth-stitch-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
            CREDENTIAL RECOVERY
          </span>
        </div>
        <h1 className="auth-login-title">{copy.title}</h1>
        <p className="auth-login-subtitle">{copy.subtitle}</p>
      </header>
      <ForgotPasswordForm locale={locale} />
    </AuthStitchFrame>
  );
}
