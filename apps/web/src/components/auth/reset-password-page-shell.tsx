import { getAuthResetCopy } from "@/lib/auth/messages";
import { resetPasswordPathForLocale } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";

import { AuthStitchFrame } from "./auth-stitch-frame";
import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordPageShellProps = {
  locale: AuthLocale;
};

export function ResetPasswordPageShell({ locale }: ResetPasswordPageShellProps) {
  const copy = getAuthResetCopy(locale);
  return (
    <AuthStitchFrame
      locale={locale}
      localeHrefFor={(item) => resetPasswordPathForLocale(item)}
      variant="recovery"
    >
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200/90 bg-slate-100/90 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5B00]" />
          <span className="auth-stitch-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-700">
            CREDENTIAL UPDATE
          </span>
        </div>
        <h1 className="auth-login-title">{copy.title}</h1>
        <p className="auth-login-subtitle">{copy.subtitle}</p>
      </header>
      <ResetPasswordForm locale={locale} />
    </AuthStitchFrame>
  );
}
