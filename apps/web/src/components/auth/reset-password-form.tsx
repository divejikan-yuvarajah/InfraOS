"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resetPasswordWithAuthClient,
  type ResetPasswordOutcome,
} from "@/lib/auth/client";
import { getAuthResetCopy } from "@/lib/auth/messages";
import { loginPathForLocale } from "@/lib/auth/redirect";
import { readResetTokenFromHash, retainResetToken } from "@/lib/auth/reset-fragment";
import type { AuthLocale } from "@/lib/auth/types";

type ResetPasswordFormProps = {
  locale: AuthLocale;
};

/** Survives a development remount and a client-side language change. Not browser storage. */
let rememberedResetToken: string | null = null;

export function ResetPasswordForm({ locale }: ResetPasswordFormProps) {
  const copy = getAuthResetCopy(locale);
  const statusId = useId();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<ResetPasswordOutcome | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    function capture() {
      const fromHash = readResetTokenFromHash(window.location.hash);
      const retained = retainResetToken(fromHash, rememberedResetToken);
      rememberedResetToken = retained;
      setToken(retained);
      if (fromHash) {
        setOutcome(null);
        setLocalError(null);
      }
      setReady(true);
      if (fromHash && window.location.hash.length > 0) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      }
    }
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const passwordBytes = new TextEncoder().encode(password).length;
    if (password.length < 8 || passwordBytes > 72) {
      setLocalError(passwordBytes > 72 ? copy.tooLong : copy.tooShort);
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    setOutcome(null);
    const held = token;
    const result = await resetPasswordWithAuthClient({ token: held, password });
    setPassword("");
    setOutcome(result);
    if (result !== "unavailable") {
      rememberedResetToken = null;
      setToken(null);
    }
    setSubmitting(false);
  }

  const message =
    !ready
      ? null
      : !token && !outcome
        ? copy.missing
        : outcome === "reset"
          ? copy.reset
          : outcome === "unavailable"
            ? copy.unavailable
            : outcome
              ? copy.rejected
              : localError;

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      {message ? (
        <div
          id={statusId}
          className={outcome === "reset" ? "auth-login-banner" : "auth-login-error"}
          role={outcome === "reset" ? "status" : "alert"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}
      <div className="auth-login-field">
        <label htmlFor="reset-password-input">{copy.passwordLabel}</label>
        <Input
          id="reset-password-input"
          type="password"
          autoComplete="new-password"
          value={password}
          disabled={submitting || !token}
          aria-invalid={message && outcome !== "reset" ? true : undefined}
          aria-describedby={message ? statusId : undefined}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        className="h-10 w-full bg-[var(--app-action-bg)] text-[var(--app-action-fg)] hover:opacity-90"
        disabled={submitting || !token || password.length === 0}
        aria-busy={submitting}
      >
        {submitting ? copy.submitting : copy.submit}
      </Button>
      <p className="text-sm text-[var(--app-muted)]">{copy.privacy}</p>
      <p className="text-sm text-[var(--app-muted)]">{copy.nativeReview}</p>
      <Link
        href={loginPathForLocale(locale)}
        className="text-sm text-[var(--infra-orange)] underline-offset-4 hover:underline"
      >
        {copy.backToLogin}
      </Link>
    </form>
  );
}
