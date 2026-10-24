"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { requestForgotPassword, type ForgotPasswordOutcome } from "@/lib/auth/client";
import { forgotPasswordFormSchema, type ForgotPasswordFormValues } from "@/lib/auth/forgot-password-schema";
import { getAuthForgotCopy } from "@/lib/auth/messages";
import { loginPathForLocale } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";

type ForgotPasswordFormProps = {
  locale: AuthLocale;
};

export function ForgotPasswordForm({ locale }: ForgotPasswordFormProps) {
  const copy = getAuthForgotCopy(locale);
  const statusId = useId();
  const [outcome, setOutcome] = useState<ForgotPasswordOutcome | null>(null);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
  });
  const submitting = form.formState.isSubmitting;

  async function onSubmit(values: ForgotPasswordFormValues) {
    setOutcome(null);
    const parsed = forgotPasswordFormSchema.parse(values);
    const result = await requestForgotPassword(parsed.email);
    setOutcome(result);
  }

  const message =
    outcome === "accepted"
      ? copy.accepted
      : outcome === "unavailable"
        ? copy.unavailable
        : outcome === "rejected"
          ? copy.unavailable
          : null;

  return (
    <Form {...form}>
      <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <p className="auth-login-banner" role="status">
          {copy.demoNotice}
        </p>
        {message ? (
          <div
            id={statusId}
            className={outcome === "accepted" ? "auth-login-banner" : "auth-login-error"}
            role={outcome === "accepted" ? "status" : "alert"}
            aria-live="polite"
          >
            {message}
          </div>
        ) : null}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="auth-login-field">
              <label htmlFor={`${field.name}-input`}>{copy.emailLabel}</label>
              <FormControl>
                <Input
                  {...field}
                  id={`${field.name}-input`}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  disabled={submitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="h-10 w-full bg-[var(--app-action-bg)] text-[var(--app-action-fg)] hover:opacity-90"
          disabled={submitting}
        >
          {submitting ? copy.submitting : outcome ? copy.retry : copy.submit}
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
    </Form>
  );
}
