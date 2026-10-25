"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchSelfProfile, updateSelfProfile } from "@/lib/profile/api";
import { getProfileCopy } from "@/lib/profile/messages";
import { profileFormSchema, type ProfileFormValues } from "@/lib/profile/schema";
import type { SelfProfile } from "@/lib/profile/types";

function formatLastLogin(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value),
    );
  } catch {
    return "—";
  }
}

export function ProfilePageClient() {
  const statusId = useId();
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getProfileCopy(locale);
  const [profile, setProfile] = useState<SelfProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [conflict, setConflict] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { firstName: "", lastName: "" },
    mode: "onSubmit",
  });

  const applyProfile = useCallback(
    (next: SelfProfile) => {
      setProfile(next);
      form.reset({ firstName: next.firstName, lastName: next.lastName });
      setConflict(false);
    },
    [form],
  );

  const reloadProfile = useCallback(async () => {
    setLoadState("loading");
    setBanner(null);
    try {
      const next = await fetchSelfProfile();
      applyProfile(next);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      if (error instanceof ApiError && error.status === 401) {
        setBanner({ tone: "error", text: copy.forbidden });
        return;
      }
      setBanner({ tone: "error", text: copy.unavailable });
    }
  }, [applyProfile, copy.forbidden, copy.unavailable]);

  useEffect(() => {
    let cancelled = false;
    void fetchSelfProfile()
      .then((next) => {
        if (cancelled) return;
        applyProfile(next);
        setLoadState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState("error");
        if (error instanceof ApiError && error.status === 401) {
          setBanner({ tone: "error", text: copy.forbidden });
          return;
        }
        setBanner({ tone: "error", text: copy.unavailable });
      });
    return () => {
      cancelled = true;
    };
  }, [applyProfile, copy.forbidden, copy.unavailable]);

  async function onSubmit(values: ProfileFormValues) {
    if (!profile) return;
    setBanner(null);
    setConflict(false);
    try {
      const next = await updateSelfProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        revision: profile.revision,
      });
      applyProfile(next);
      setBanner({ tone: "ok", text: copy.saved });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        setBanner({ tone: "error", text: copy.conflict });
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setBanner({ tone: "error", text: copy.forbidden });
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        setBanner({ tone: "error", text: copy.forbidden });
        return;
      }
      setBanner({ tone: "error", text: copy.unavailable });
    }
  }

  function cancelEdit() {
    if (!profile) return;
    form.reset({ firstName: profile.firstName, lastName: profile.lastName });
    setBanner(null);
    setConflict(false);
  }

  const submitting = form.formState.isSubmitting;

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle}>
      <section className="auth-access-card" aria-labelledby="profile-locale">
        <p id="profile-locale" className="auth-access-field-label">
          View language (draft)
        </p>
        <div className="auth-access-locale-row" role="group" aria-label="Profile view language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={locale === code ? "auth-access-chip is-active" : "auth-access-chip"}
              onClick={() => setLocale(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="auth-access-hint">{copy.nativeReview}</p>
      </section>

      {loadState === "loading" ? (
        <p className="auth-access-status" role="status">
          Loading…
        </p>
      ) : null}
      {loadState === "error" && !profile ? (
        <p className="auth-access-status" role="alert">
          {copy.loadError}
        </p>
      ) : null}

      {profile ? (
        <>
          <section className="auth-access-card" aria-label="Account summary">
            <dl className="auth-access-dl">
              <div>
                <dt>{copy.email}</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>{copy.role}</dt>
                <dd>{profile.roleKey.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>{copy.agency}</dt>
                <dd>{profile.agencyName ?? profile.agencyId ?? "—"}</dd>
              </div>
              <div>
                <dt>{copy.verified}</dt>
                <dd>{profile.emailVerified ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>{copy.lastLogin}</dt>
                <dd>{formatLastLogin(profile.lastLoginAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="auth-access-card" aria-labelledby="profile-edit">
            <h2 id="profile-edit" className="auth-access-section-title">
              {copy.title}
            </h2>
            <Form {...form}>
              <form className="auth-access-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.firstName}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="given-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.lastName}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="family-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="auth-access-actions">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? copy.saving : copy.save}
                  </Button>
                  <Button type="button" variant="outline" disabled={submitting} onClick={cancelEdit}>
                    {copy.cancel}
                  </Button>
                  {conflict ? (
                    <Button type="button" variant="secondary" onClick={() => void reloadProfile()}>
                      {copy.reload}
                    </Button>
                  ) : null}
                </div>
              </form>
            </Form>
          </section>
        </>
      ) : null}

      {banner ? (
        <p
          id={statusId}
          className={banner.tone === "ok" ? "auth-access-banner ok" : "auth-access-banner error"}
          role={banner.tone === "ok" ? "status" : "alert"}
        >
          {banner.text}
        </p>
      ) : null}
    </StaffWorkspaceShell>
  );
}
