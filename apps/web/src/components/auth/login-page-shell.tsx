import { BrandMark } from "@/components/common/brand-mark";
import { getAuthLoginCopy } from "@/lib/auth/messages";
import { loginPathForLocale, sanitizeNextParam } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";

import { AuthStitchFrame } from "./auth-stitch-frame";
import { LoginForm } from "./login-form";

type LoginPageShellProps = {
  locale: AuthLocale;
  nextParam?: string | null;
};

function loginPathWithNext(
  locale: AuthLocale,
  nextParam: string | null | undefined,
): string {
  const base = loginPathForLocale(locale);
  const safe = sanitizeNextParam(nextParam ?? null);
  return safe ? `${base}?next=${encodeURIComponent(safe)}` : base;
}

const CLEARANCE_BADGE: Record<AuthLocale, string> = {
  en: "STATUTORY CLEARANCE REQUIRED",
  si: "ව්‍යවස්ථාපිත ප්‍රවේශ අවසරය අවශ්‍යයි",
  ta: "சட்டபூர்வ அனுமதி தேவை",
};

export function LoginPageShell({ locale, nextParam }: LoginPageShellProps) {
  const copy = getAuthLoginCopy(locale);
  return (
    <AuthStitchFrame
      locale={locale}
      localeHrefFor={(item) => loginPathWithNext(item, nextParam)}
      variant="login"
    >
      <header className="mb-4 flex flex-col items-center text-center">
        <div className="mb-2.5 flex items-center gap-2.5">
          <BrandMark size={36} className="shadow-xs" />
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-[#ECEEF0] px-3.5 py-1 text-slate-900 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#279541] animate-pulse" aria-hidden="true" />
            <span className="text-[10.5px] font-bold tracking-wide uppercase">
              {CLEARANCE_BADGE[locale]}
            </span>
          </div>
        </div>
        <h1 className="auth-login-title text-center">{copy.title}</h1>
        <p className="auth-login-subtitle mx-auto max-w-lg text-center">
          {copy.subtitle}
        </p>
      </header>
      <LoginForm locale={locale} nextParam={nextParam} />
    </AuthStitchFrame>
  );
}
