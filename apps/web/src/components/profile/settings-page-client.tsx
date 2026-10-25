"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { Button } from "@/components/ui/button";
import { logoutWithAuthClient } from "@/lib/auth/client";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchSelfProfile } from "@/lib/profile/api";
import { getSettingsCopy } from "@/lib/profile/messages";
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

export function SettingsPageClient() {
  const router = useRouter();
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getSettingsCopy(locale);
  const [profile, setProfile] = useState<SelfProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSelfProfile()
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    setLeaving(true);
    await logoutWithAuthClient();
    router.replace("/");
  }

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle}>
      <section className="auth-access-card" aria-labelledby="settings-locale">
        <p id="settings-locale" className="auth-access-field-label">
          View language (draft)
        </p>
        <div className="auth-access-locale-row" role="group" aria-label="Settings view language">
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
      {loadState === "error" ? (
        <p className="auth-access-status" role="alert">
          {copy.unavailable}
        </p>
      ) : null}

      {profile ? (
        <section className="auth-access-card" aria-label="Account overview">
          <dl className="auth-access-dl">
            <div>
              <dt>{copy.email}</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>{copy.verified}</dt>
              <dd>{profile.emailVerified ? "Verified" : "Pending"}</dd>
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
              <dt>{copy.lastLogin}</dt>
              <dd>{formatLastLogin(profile.lastLoginAt)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="auth-access-card" aria-labelledby="settings-security">
        <h2 id="settings-security" className="auth-access-section-title">
          {copy.passwordReset}
        </h2>
        <p className="auth-access-copy">{copy.passwordResetBody}</p>
        <p className="auth-access-hint">{copy.demoEmail}</p>
        <div className="auth-access-actions">
          <Link className="auth-access-link" href="/forgot-password">
            {copy.passwordReset}
          </Link>
          <Link className="auth-access-link" href="/profile">
            {copy.profileLink}
          </Link>
          <Button type="button" variant="outline" disabled={leaving} onClick={() => void signOut()}>
            {copy.signOut}
          </Button>
        </div>
      </section>
    </StaffWorkspaceShell>
  );
}
