import { getAuthLoginCopy } from "@/lib/auth/messages";
import { loginPathForLocale, sanitizeNextParam } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";

import { AuthStitchFrame } from "./auth-stitch-frame";
import { LoginForm } from "./login-form";

type LoginPageShellProps = {
  locale: AuthLocale;
  nextParam?: string | null;
};

function loginPathWithNext(locale: AuthLocale, nextParam: string | null | undefined): string {
  const base = loginPathForLocale(locale);
  const safe = sanitizeNextParam(nextParam ?? null);
  return safe ? `${base}?next=${encodeURIComponent(safe)}` : base;
}

export function LoginPageShell({ locale, nextParam }: LoginPageShellProps) {
  const copy = getAuthLoginCopy(locale);
  return (
    <AuthStitchFrame
      locale={locale}
      localeHrefFor={(item) => loginPathWithNext(item, nextParam)}
      variant="login"
    >
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200/90 bg-slate-100/90 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5B00]" />
          <span className="auth-stitch-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-700">
            {copy.eyebrow}
          </span>
        </div>
        <h1 className="auth-login-title">{copy.title}</h1>
        <p className="auth-login-subtitle">{copy.subtitle}</p>
      </header>
      <LoginForm locale={locale} nextParam={nextParam} />
    </AuthStitchFrame>
  );
}
