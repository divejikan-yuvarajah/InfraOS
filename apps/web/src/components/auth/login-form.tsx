"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { loginWithAuthClient } from "@/lib/auth/client";
import { getAuthAvailability } from "@/lib/auth/availability";
import { loginFormSchema, type LoginFormValues } from "@/lib/auth/login-schema";
import { getAuthLoginCopy } from "@/lib/auth/messages";
import { forgotPasswordPathForLocale, sanitizeNextParam } from "@/lib/auth/redirect";
import type { AuthLocale } from "@/lib/auth/types";
import { publicHomePath, publicInfoPath } from "@/lib/landing/locales";

type LoginFormProps = {
  locale: AuthLocale;
  nextParam?: string | null;
};

export function LoginForm({ locale, nextParam }: LoginFormProps) {
  const copy = getAuthLoginCopy(locale);
  const statusId = useId();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const availability = getAuthAvailability();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const submitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    const parsed = loginFormSchema.parse(values);
    const result = await loginWithAuthClient({
      email: parsed.email,
      password: values.password,
    });
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    const safeNext = sanitizeNextParam(nextParam);
    router.push(safeNext ?? publicHomePath(locale));
  }

  return (
    <Form {...form}>
      <form
        className="space-y-5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        aria-describedby={`${statusId}-banner${formError ? ` ${statusId}` : ""}`}
      >
        <div
          id={`${statusId}-banner`}
          className="auth-login-banner"
          role="status"
          aria-live="polite"
        >
          {availability !== "live" ? copy.notLiveBanner : copy.demoNotice}
        </div>

        {formError ? (
          <div
            id={statusId}
            className="auth-login-error"
            role="alert"
            aria-live="assertive"
          >
            {formError}
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
                  autoComplete="username"
                  inputMode="email"
                  disabled={submitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="auth-login-field">
              <label htmlFor={`${field.name}-input`}>{copy.passwordLabel}</label>
              <div className="auth-login-password-row">
                <FormControl>
                  <Input
                    {...field}
                    id={`${field.name}-input`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    disabled={submitting}
                    className="pr-16"
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="auth-login-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                >
                  {showPassword ? copy.hidePassword : copy.showPassword}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <p className="text-sm">
          <Link
            href={forgotPasswordPathForLocale(locale)}
            className="text-[var(--infra-orange)] underline-offset-4 hover:underline"
          >
            {copy.forgotPassword}
          </Link>
        </p>

        <Button
          type="submit"
          className="h-10 w-full bg-[var(--app-action-bg)] text-[var(--app-action-fg)] hover:opacity-90"
          disabled={submitting}
        >
          {submitting ? copy.submitting : copy.submit}
        </Button>

        <p className="text-sm text-[var(--app-muted)]">{copy.nativeReview}</p>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href={publicInfoPath(locale, "how-it-works")}
            className="text-[var(--infra-orange)] underline-offset-4 hover:underline"
          >
            {copy.helpLink}
          </Link>
          <Link
            href={publicHomePath(locale)}
            className="text-[var(--infra-orange)] underline-offset-4 hover:underline"
          >
            {copy.homeLink}
          </Link>
        </div>
      </form>
    </Form>
  );
}
