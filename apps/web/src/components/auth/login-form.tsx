"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
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

import { LiquidGlassInput } from "./liquid-glass-input";
import { PillButton } from "./pill-button";

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
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
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

      {/* Field 1: Work Email Address (LiquidGlassInput) */}
      <LiquidGlassInput
        id="auth-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        required
        label={copy.emailLabel}
        suffixBadge=".gov.lk / .rda.lk"
        icon={<Mail className="h-4.5 w-4.5" />}
        placeholder="officer@transport.gov.lk"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (emailError) setEmailError(null);
        }}
        disabled={submitting}
        error={emailError}
        errorId={emailErrorId}
        helperText={copy.emailHelper}
      />

      {/* Field 2: Password with Eye Visibility Toggle & Forgot Link */}
      <LiquidGlassInput
        id="auth-password"
        name="password"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        required
        label={copy.passwordLabel}
        icon={<Lock className="h-4.5 w-4.5" />}
        placeholder="Enter statutory authorization key"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          if (passwordError) setPasswordError(null);
        }}
        disabled={submitting}
        error={passwordError}
        errorId={passwordErrorId}
        rightLabelSlot={
          <Link
            href={forgotPasswordPathForLocale(locale)}
            className="text-xs font-semibold text-[#A83900] transition-colors hover:text-[#FF5B00] hover:underline"
          >
            {copy.forgotLink}
          </Link>
        }
        trailingControl={
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-pressed={showPassword}
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#FF5B00] focus-visible:outline-none"
          >
            {showPassword ? (
              <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <Eye className="h-4.5 w-4.5" aria-hidden="true" />
            )}
          </button>
        }
      />

      {/* Keep Active on Secured Terminal + TLS 1.3 FIPS Live Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 select-none">
          <input
            type="checkbox"
            checked={keepTerminalActive}
            onChange={(event) => setKeepTerminalActive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-[#FF5B00] focus:ring-[#FF5B00]"
          />
          <span>{copy.keepActiveLabel}</span>
        </label>
        <span className="auth-stitch-mono inline-flex items-center gap-1.5 rounded-full bg-[#279541]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#279541]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#279541]" />
          {copy.tlsBadge}
        </span>
      </div>

      {/* Primary Curved Pill CTA with Survey Target Node */}
      <div className="relative pt-1">
        <div
          className="pointer-events-none absolute top-1/2 -left-5 hidden -translate-y-1/2 items-center justify-center lg:flex"
          aria-hidden="true"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF5B00] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FF5B00] shadow-xs" />
          </span>
        </div>

        <PillButton type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
              <span>{copy.submitting}</span>
            </>
          ) : (
            <>
              <span>{copy.submit}</span>
              <ArrowRight className="h-4.5 w-4.5" aria-hidden="true" />
            </>
          )}
        </PillButton>
      </div>

      {/* Institutional Account Creation / Invitation Footer */}
      <div className="mt-2.5 border-t border-slate-200/80 pt-2.5 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-medium text-slate-600">
            New officer or agency director?
          </span>
          <Link
            href={registerPathForLocale(locale)}
            className="font-bold text-[#A83900] transition-colors hover:text-[#FF5B00] hover:underline"
          >
            Create an Account (Invitation Only)
          </Link>
        </div>
        <p className="mx-auto mt-1 max-w-md text-[10.5px] leading-snug text-slate-500">
          {copy.onboardingNotice}
        </p>
      </div>
    </form>
  );
}
