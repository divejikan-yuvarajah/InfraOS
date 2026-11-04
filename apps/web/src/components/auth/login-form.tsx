"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

import { getAuthAvailability } from "@/lib/auth/availability";
import { loginWithAuthClient } from "@/lib/auth/client";
import { loginFormSchema } from "@/lib/auth/login-schema";
import { getAuthLoginCopy } from "@/lib/auth/messages";
import {
  forgotPasswordPathForLocale,
  registerPathForLocale,
  sanitizeNextParam,
} from "@/lib/auth/redirect";
import { DASHBOARD_PATH } from "@/lib/auth/route-access";
import type { AuthFailureCode, AuthLocale } from "@/lib/auth/types";

type LoginFormProps = {
  locale: AuthLocale;
  nextParam?: string | null;
};

export function LoginForm({ locale, nextParam }: LoginFormProps) {
  const router = useRouter();
  const copy = getAuthLoginCopy(locale);
  const availability = getAuthAvailability();
  const statusId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepTerminalActive, setKeepTerminalActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<AuthFailureCode | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setSubmitError(null);

    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") setEmailError(issue.message);
        if (issue.path[0] === "password") setPasswordError(issue.message);
      }
      setSubmitError("VALIDATION");
      return;
    }

    setSubmitting(true);
    try {
      const result = await loginWithAuthClient(parsed.data);
      if (!result.ok) {
        setSubmitError(result.code);
        return;
      }
      const target = sanitizeNextParam(nextParam) ?? DASHBOARD_PATH;
      router.replace(target);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-3"
      aria-describedby={availability !== "live" ? statusId : undefined}
    >
      {availability !== "live" ? (
        <div
          id={statusId}
          role="status"
          className="auth-login-banner flex items-start gap-2"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>{copy.previewBanner}</span>
        </div>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="auth-login-error flex items-start gap-2"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8C1F28]"
            aria-hidden="true"
          />
          <span>{copy.errors[submitError]}</span>
        </div>
      ) : null}

      {/* Work Email Field */}
      <div className="auth-login-field">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <label htmlFor="auth-email" className="mb-0">
            {copy.emailLabel} <span className="text-[#8C1F28]">*</span>
          </label>
          <span className="auth-stitch-mono text-[10px] text-slate-400">
            {copy.emailDomainHint}
          </span>
        </div>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="auth-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            placeholder="officer@transport.gov.lk"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailError ? "true" : "false"}
            aria-describedby={emailError ? emailErrorId : undefined}
            disabled={submitting}
            className={`h-10 w-full rounded-lg border bg-white pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none disabled:opacity-60 ${
              emailError
                ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
            }`}
          />
        </div>
        {emailError ? (
          <p id={emailErrorId} className="mt-1 text-[11px] font-medium text-[#8C1F28]">
            {emailError}
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{copy.emailHelper}</span>
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="auth-login-field">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <label htmlFor="auth-password" className="mb-0">
            {copy.passwordLabel} <span className="text-[#8C1F28]">*</span>
          </label>
          <Link
            href={forgotPasswordPathForLocale(locale)}
            className="text-xs font-semibold text-[#C43D00] transition-colors hover:text-[#FF5B00] hover:underline"
          >
            {copy.forgotLink}
          </Link>
        </div>
        <div className="auth-login-password-row">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="auth-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={passwordError ? "true" : "false"}
            aria-describedby={passwordError ? passwordErrorId : undefined}
            disabled={submitting}
            className={`h-10 w-full rounded-lg border bg-white pr-11 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none disabled:opacity-60 ${
              passwordError
                ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-pressed={showPassword}
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            className="auth-login-password-toggle inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#FF5B00] focus-visible:outline-none"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {passwordError ? (
          <p id={passwordErrorId} className="mt-1 text-[11px] font-medium text-[#8C1F28]">
            {passwordError}
          </p>
        ) : null}
      </div>

      {/* Secured Terminal Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 select-none">
          <input
            type="checkbox"
            checked={keepTerminalActive}
            onChange={(event) => setKeepTerminalActive(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#FF5B00] focus:ring-[#FF5B00]"
          />
          <span>{copy.keepActiveLabel}</span>
        </label>
        <span className="auth-stitch-mono inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-[#279541]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#279541]" />
          {copy.tlsBadge}
        </span>
      </div>

      {/* Primary Sign In CTA */}
      <div className="pt-0.5">
        <button
          type="submit"
          disabled={submitting}
          className="auth-primary-cta inline-flex h-10.5 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[#FF5B00] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{copy.submitting}</span>
            </>
          ) : (
            <>
              <span>{copy.submit}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* Institutional Account Creation / Onboarding Box */}
      <div className="mt-2.5 rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            <Building2 className="h-3.5 w-3.5 text-[#C43D00]" aria-hidden="true" />
            <span>{copy.newOfficerPrompt}</span>
          </span>
          <Link
            href={registerPathForLocale(locale)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#C43D00] transition-colors hover:text-[#FF5B00] hover:underline"
          >
            <span>{copy.createAccountLink}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <p className="mx-auto mt-1 max-w-md text-[10.5px] leading-snug text-slate-500">
          {copy.onboardingNotice}
        </p>
      </div>
    </form>
  );
}
