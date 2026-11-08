"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ROLE_LABELS, initialsOf } from "@/components/auth/workspace-nav";
import { logoutWithAuthClient } from "@/lib/auth/client";
import {
  getAuthEpoch,
  getMemoryAccessToken,
  getMemorySession,
  setAuthenticated,
  subscribeAuth,
} from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import {
  useWorkspaceDensity,
  useWorkspaceReducedMotion,
} from "@/lib/i18n/workspace-preferences";
import { fetchSelfProfile, updateSelfProfile } from "@/lib/profile/api";
import {
  getProfileCopy,
  getSettingsCopy,
  type ProfileCopy,
  type SettingsCopy,
} from "@/lib/profile/messages";
import type { SelfProfile } from "@/lib/profile/types";
import { classifyEditError } from "@/lib/projects/edit-outcome";

type NameFormValues = { firstName: string; lastName: string };

const nameFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
});

function formatLastLogin(iso: string | null, locale: AuthLocale): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(
      locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ProfilePageClient({
  mode = "profile",
}: {
  mode?: "profile" | "settings";
}) {
  const router = useRouter();
  const [locale, setLocale] = useWorkspaceLocale();
  const [density, setDensity] = useWorkspaceDensity();
  const [reducedMotion, setReducedMotion] = useWorkspaceReducedMotion();
  const copy = getProfileCopy(locale);
  const settingsCopy = getSettingsCopy(locale);

  const epoch = useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
  const hasToken = useSyncExternalStore(
    subscribeAuth,
    () => Boolean(getMemoryAccessToken()),
    () => false,
  );
  const queryClient = useQueryClient();

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", "me", epoch],
    queryFn: fetchSelfProfile,
    enabled: hasToken,
    retry: false,
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logoutWithAuthClient();
    } finally {
      router.replace("/login");
    }
  };

  const pageTitle = mode === "settings" ? settingsCopy.title : copy.title;
  const pageSubtitle =
    mode === "settings" ? settingsCopy.subtitle : copy.subtitle;

  return (
    <StaffWorkspaceShell
      title={pageTitle}
      subtitle={pageSubtitle}
      section="Personal Workspace"
      breadcrumbs={[{ label: pageTitle }]}
      scopeLabel={profileQuery.data?.agencyName ?? undefined}
      hidePageHeader
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-gutter-desktop py-6 space-y-6 pb-12">
        {/* PAGE HEADER & EDITORIAL CONTEXT */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant/30 pb-4">
          <div>
            <div className="flex items-center gap-2 text-label-sm font-label-sm uppercase text-secondary mb-1.5 flex-wrap">
              <span className="material-symbols-outlined text-[14px]">
                verified_user
              </span>
              <span>Personal Workspace</span>
              <span>/</span>
              <span>
                {mode === "settings" ? "CORE-01.26 Settings" : "CORE-01.23 Profile"}
              </span>
              <span>/</span>
              <span className="px-1.5 py-0.5 bg-secondary-fixed text-on-secondary-fixed rounded-xs font-mono">
                [ CERTIFIED RECORD ]
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              {mode === "settings"
                ? settingsCopy.title
                : "Account Profile & Governance Credentials"}
            </h1>
            <p className="text-body-md text-on-surface-variant mt-1 max-w-2xl">
              {pageSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-end">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/40 text-xs text-on-surface-variant shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Identity Node:</span>
              <strong className="font-mono text-on-surface">Synced</strong>
            </div>
            {mode === "profile" ? (
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/60 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">
                  settings
                </span>
                <span>{settingsCopy.title}</span>
              </Link>
            ) : (
              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/60 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">
                  person
                </span>
                <span>{settingsCopy.profileLink}</span>
              </Link>
            )}
          </div>
        </div>

        {!hasToken || profileQuery.isPending ? (
          <div
            className="bg-surface-container-lowest p-8 rounded border border-outline-variant/30 shadow-2xs flex items-center gap-3"
            role="status"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-secondary-container animate-ping" />
            <span className="font-title-md text-title-md text-on-surface">
              Loading profile…
            </span>
          </div>
        ) : profileQuery.isError ? (
          <div
            className="bg-error-container/25 border border-error/30 rounded p-6 flex items-center justify-between gap-4"
            role="alert"
          >
            <span className="font-semibold text-on-error-container">
              {copy.loadError}
            </span>
            <button
              type="button"
              onClick={() => void profileQuery.refetch()}
              className="px-3.5 py-1.5 rounded bg-secondary text-white text-xs font-semibold"
            >
              {copy.reload}
            </button>
          </div>
        ) : (
          <ProfileWorkspaceGrid
            profile={profileQuery.data}
            copy={copy}
            settingsCopy={settingsCopy}
            locale={locale}
            onLocaleChange={setLocale}
            density={density}
            onDensityChange={setDensity}
            reducedMotion={reducedMotion}
            onReducedMotionChange={setReducedMotion}
            epoch={epoch}
            confirmSignOut={confirmSignOut}
            onConfirmSignOutChange={setConfirmSignOut}
            signingOut={signingOut}
            onSignOut={() => void handleSignOut()}
            onReload={() => void profileQuery.refetch()}
            onSaved={(next) => {
              queryClient.setQueryData(["profile", "me", epoch], next);
              const current = getMemorySession();
              if (current) {
                setAuthenticated({
                  ...current,
                  user: {
                    ...current.user,
                    firstName: next.firstName,
                    lastName: next.lastName,
                    displayName: next.displayName,
                  },
                });
              }
            }}
          />
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

function ProfileWorkspaceGrid({
  profile,
  copy,
  settingsCopy,
  locale,
  onLocaleChange,
  density,
  onDensityChange,
  reducedMotion,
  onReducedMotionChange,
  epoch,
  confirmSignOut,
  onConfirmSignOutChange,
  signingOut,
  onSignOut,
  onReload,
  onSaved,
}: {
  profile: SelfProfile;
  copy: ProfileCopy;
  settingsCopy: SettingsCopy;
  locale: AuthLocale;
  onLocaleChange: (l: AuthLocale) => void;
  density: "standard" | "dense";
  onDensityChange: (d: "standard" | "dense") => void;
  reducedMotion: boolean;
  onReducedMotionChange: (r: boolean) => void;
  epoch: number;
  confirmSignOut: boolean;
  onConfirmSignOutChange: (v: boolean) => void;
  signingOut: boolean;
  onSignOut: () => void;
  onReload: () => void;
  onSaved: (next: SelfProfile) => void;
}) {
  const [banner, setBanner] = useState<
    | { kind: "saved" | "unchanged" }
    | { kind: "conflict" | "forbidden" | "other" }
    | null
  >(null);

  const form = useForm<NameFormValues>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
  });

  useEffect(() => {
    form.reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
  }, [profile.revision, profile.firstName, profile.lastName, form]);

  const mutation = useMutation({
    mutationFn: (values: NameFormValues) =>
      updateSelfProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        revision: profile.revision,
      }),
    onSuccess: (next) => {
      onSaved(next);
      setBanner({ kind: "saved" });
    },
    onError: (err) => {
      const failure = classifyEditError(err);
      if (failure === "conflict") {
        setBanner({ kind: "conflict" });
      } else if (failure === "denied") {
        setBanner({ kind: "forbidden" });
      } else {
        setBanner({ kind: "other" });
      }
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setBanner(null);
    if (
      values.firstName.trim() === profile.firstName &&
      values.lastName.trim() === profile.lastName
    ) {
      setBanner({ kind: "unchanged" });
      return;
    }
    mutation.mutate(values);
  });

  const displayName =
    profile.displayName ||
    `${profile.firstName} ${profile.lastName}`.trim() ||
    profile.email;
  const roleLabel = ROLE_LABELS[profile.roleKey] ?? profile.roleKey;
  const agencyDisplay =
    profile.agencyName ?? profile.agencyId ?? "All Agencies (National)";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN (4 Cols): Identity Summary & Security/Session Actions */}
      <div className="lg:col-span-4 space-y-6">
        {/* 1. Profile Identity Card */}
        <section
          aria-label="Officer Identity Summary"
          className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden relative"
        >
          {/* Top Accent Thread */}
          <div className="h-[3px] w-full bg-secondary" />

          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded bg-primary-container text-white flex items-center justify-center font-headline-md text-xl font-bold border-2 border-outline-variant/40 shadow-sm">
                  {initialsOf(displayName)}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white"
                  title={copy.verified}
                >
                  <span className="material-symbols-outlined text-[12px]">
                    check
                  </span>
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-title-lg text-title-lg text-on-surface truncate">
                  {displayName}
                </h2>
                <p className="text-body-md text-on-surface-variant font-medium truncate">
                  {profile.email}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-container text-white text-[11px] font-bold tracking-wider uppercase font-mono">
                    <span className="text-secondary-container">●</span>{" "}
                    {profile.roleKey}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface text-[11px] font-semibold">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Institutional Lineage Details */}
            <div className="mt-6 pt-4 border-t border-outline-variant/25 space-y-3 text-body-md">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-on-surface-variant font-medium">
                  {copy.agency}
                </span>
                <div className="text-right">
                  <div className="text-xs font-semibold text-on-surface">
                    {agencyDisplay}
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-mono">
                    {profile.agencyId ? `ID: ${profile.agencyId}` : "National Scope"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-on-surface-variant font-medium">
                  {copy.verified}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs border border-dashed border-emerald-600/50 bg-emerald-50/50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                  <span>✓</span> [ {profile.status} · GOV VERIFIED ]
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-on-surface-variant font-medium">
                  {copy.lastLogin}
                </span>
                <span className="text-xs font-mono text-on-surface tabular-nums">
                  {formatLastLogin(profile.lastLoginAt, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Subtle Bottom Bar */}
          <div className="px-6 py-3 bg-surface-container-low/60 border-t border-outline-variant/25 flex items-center justify-between text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-secondary">
                shield_lock
              </span>
              <span>RBAC Policy Enforced</span>
            </span>
            <span className="font-mono font-semibold text-on-surface tabular-nums">
              rev #{profile.revision}
            </span>
          </div>
        </section>

        {/* 2. Security & Session Actions Card (CORE-01.26) */}
        <section
          aria-label="Security and Session Controls"
          className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden"
        >
          <div className="p-5 border-b border-outline-variant/25 flex items-center justify-between">
            <div>
              <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  security
                </span>
                <span>Security &amp; Authentication</span>
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {settingsCopy.subtitle}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Password Reset Link Action */}
            <div className="p-3.5 rounded bg-surface-container-low/50 border border-outline-variant/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <span>{settingsCopy.passwordReset}</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {settingsCopy.passwordResetBody}
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-lowest border border-outline-variant/60 text-xs font-semibold text-on-surface hover:bg-surface-container hover:border-outline transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  lock_reset
                </span>
                <span>Request Reset</span>
              </Link>
            </div>

            {/* Active Session Telemetry */}
            <div className="p-3.5 rounded bg-surface-container-low/50 border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>Active Command Session</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  ACTIVE (EPOCH #{epoch})
                </span>
              </div>
              <div className="text-[11px] text-on-surface-variant leading-relaxed">
                {settingsCopy.demoEmail}
              </div>
            </div>

            {/* Sign Out Flow with Inline Confirmation */}
            <div className="pt-2 border-t border-outline-variant/25 space-y-3">
              {!confirmSignOut ? (
                <button
                  type="button"
                  onClick={() => onConfirmSignOutChange(true)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded border border-error/30 bg-error-container/25 hover:bg-error-container/50 text-on-error-container text-xs font-bold transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-error">
                      logout
                    </span>
                    <span>{settingsCopy.signOut}</span>
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-error group-hover:translate-x-0.5 transition-transform">
                    arrow_forward
                  </span>
                </button>
              ) : (
                <div
                  id="signoutConfirmation"
                  className="p-3.5 rounded bg-error-container/40 border border-error/40 space-y-2.5"
                  role="region"
                  aria-label="Confirm session termination"
                >
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-error mt-0.5">
                      warning
                    </span>
                    <div>
                      <div className="text-xs font-bold text-on-error-container">
                        Confirm Session Termination?
                      </div>
                      <p className="text-[11px] text-on-error-container/90 mt-0.5 leading-snug">
                        This will revoke your active bearer token and return you to the sovereign sign-in gateway.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={() => onConfirmSignOutChange(false)}
                      className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant/60 text-[11px] font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      {copy.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={onSignOut}
                      className="px-3 py-1 rounded bg-error text-white text-[11px] font-bold hover:brightness-110 transition-all shadow-2xs"
                    >
                      {signingOut ? "Signing out…" : "Terminate Now"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN (8 Cols): Editable Profile Form & Workspace Preferences */}
      <div className="lg:col-span-8 space-y-6">
        {/* SECTION 1: Personal & Operational Details Form */}
        <section
          aria-label="Personal and Operational Details Form"
          className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden"
        >
          {/* Section Header */}
          <div className="p-5 border-b border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-container-lowest">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-title-lg text-title-lg text-on-surface">
                  Personal &amp; Operational Details
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-surface-container-low text-on-surface-variant rounded border border-outline-variant/30 tabular-nums">
                  rev: {profile.revision}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {copy.subtitle}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-dashed border-outline-variant text-on-surface-variant text-[10px] font-bold uppercase tracking-wider self-start sm:self-center">
              [ OPTIMISTIC LOCK ]
            </span>
          </div>

          {/* Form Body */}
          <form className="p-6 space-y-6" onSubmit={onSubmit} noValidate>
            {/* Optimistic Concurrency / Revision Banner */}
            {banner?.kind === "conflict" ? (
              <div
                className="p-3.5 rounded bg-error-container/35 border border-error/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                role="alert"
              >
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-error mt-0.5">
                    sync_problem
                  </span>
                  <div className="text-xs text-on-error-container leading-relaxed">
                    <strong className="font-bold block">
                      Concurrent Modification Detected (409)
                    </strong>
                    <span>{copy.conflict}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBanner(null);
                    onReload();
                  }}
                  className="px-3 py-1.5 rounded bg-error text-white text-xs font-bold shrink-0"
                >
                  {copy.reload}
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded bg-surface-container-low/70 border border-outline-variant/40 flex items-start gap-3">
                <span className="material-symbols-outlined text-[18px] text-secondary mt-0.5">
                  sync_saved_locally
                </span>
                <div className="text-xs text-on-surface-variant leading-relaxed">
                  <strong className="text-on-surface font-semibold">
                    Concurrency Protection Active:
                  </strong>{" "}
                  Updates to your profile require revision token{" "}
                  <code className="px-1 py-0.5 bg-surface-container-lowest rounded border border-outline-variant/40 font-mono text-[11px] text-on-surface">
                    rev:{profile.revision}
                  </code>
                  . If another administrator updates your record simultaneously, you will be prompted to reconcile before overwriting.
                </div>
              </div>
            )}

            {/* Editable Fields Grid (First Name / Last Name) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-firstName"
                  className="block text-label-md font-label-md uppercase text-on-surface mb-1.5"
                >
                  {copy.firstName} <span className="text-secondary">*</span>
                </label>
                <div className="relative">
                  <input
                    id="profile-firstName"
                    type="text"
                    autoComplete="given-name"
                    aria-invalid={Boolean(form.formState.errors.firstName)}
                    disabled={mutation.isPending}
                    {...form.register("firstName")}
                    className="w-full px-3.5 py-2 rounded bg-surface-container-low/50 border border-outline-variant/80 text-on-surface text-body-md font-medium focus:bg-surface-container-lowest focus:border-secondary focus:outline-none transition-colors"
                  />
                  <span className="material-symbols-outlined text-[16px] text-outline absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    edit
                  </span>
                </div>
                {form.formState.errors.firstName && (
                  <p className="text-[11px] text-error font-semibold mt-1" role="alert">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profile-lastName"
                  className="block text-label-md font-label-md uppercase text-on-surface mb-1.5"
                >
                  {copy.lastName} <span className="text-secondary">*</span>
                </label>
                <div className="relative">
                  <input
                    id="profile-lastName"
                    type="text"
                    autoComplete="family-name"
                    aria-invalid={Boolean(form.formState.errors.lastName)}
                    disabled={mutation.isPending}
                    {...form.register("lastName")}
                    className="w-full px-3.5 py-2 rounded bg-surface-container-low/50 border border-outline-variant/80 text-on-surface text-body-md font-medium focus:bg-surface-container-lowest focus:border-secondary focus:outline-none transition-colors"
                  />
                  <span className="material-symbols-outlined text-[16px] text-outline absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    edit
                  </span>
                </div>
                {form.formState.errors.lastName && (
                  <p className="text-[11px] text-error font-semibold mt-1" role="alert">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Read-Only Governance Credentials Divider */}
            <div className="pt-2 border-t border-outline-variant/25">
              <div className="flex items-center justify-between mb-3">
                <span className="text-label-sm font-label-sm uppercase text-on-surface-variant">
                  Immutable Institutional Credentials
                </span>
                <span className="text-[11px] text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">
                    lock
                  </span>
                  Managed by National Directory
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Read-Only Email */}
                <div className="p-3 rounded bg-surface-container-low/60 border border-outline-variant/40">
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-medium mb-1">
                    <span>{copy.email}</span>
                    <span className="font-mono text-[10px] text-outline">
                      [ READ-ONLY ]
                    </span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-on-surface truncate">
                    {profile.email}
                  </div>
                </div>

                {/* Read-Only Agency */}
                <div className="p-3 rounded bg-surface-container-low/60 border border-outline-variant/40">
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-medium mb-1">
                    <span>{copy.agency}</span>
                    <span className="font-mono text-[10px] text-outline">
                      [ READ-ONLY ]
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-on-surface truncate">
                    {agencyDisplay}
                  </div>
                </div>

                {/* Read-Only Role Key */}
                <div className="p-3 rounded bg-surface-container-low/60 border border-outline-variant/40">
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-medium mb-1">
                    <span>{copy.role}</span>
                    <span className="font-mono text-[10px] text-outline">
                      [ READ-ONLY ]
                    </span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-secondary truncate">
                    {profile.roleKey} ({roleLabel})
                  </div>
                </div>
              </div>
            </div>

            {/* Form Footer with Save Feedback & Buttons */}
            <div className="pt-4 border-t border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs" role="status">
                {banner?.kind === "saved" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">
                      check_circle
                    </span>
                    <span>
                      {copy.saved} (rev #{profile.revision})
                    </span>
                  </span>
                ) : banner?.kind === "unchanged" ? (
                  <span className="text-on-surface-variant font-medium">
                    No changes to save.
                  </span>
                ) : banner?.kind === "forbidden" ? (
                  <span className="text-error font-semibold">
                    {copy.forbidden}
                  </span>
                ) : banner?.kind === "other" ? (
                  <span className="text-error font-semibold">
                    {copy.unavailable}
                  </span>
                ) : (
                  <span className="text-on-surface-variant">
                    {copy.nativeReview}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={mutation.isPending || !form.formState.isDirty}
                  onClick={() => {
                    setBanner(null);
                    form.reset({
                      firstName: profile.firstName,
                      lastName: profile.lastName,
                    });
                  }}
                  className="px-3.5 py-2 rounded bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-semibold hover:bg-surface-container-low transition-colors disabled:opacity-50"
                >
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gradient-to-b from-secondary to-[#802a00] text-white text-xs font-semibold shadow-sm hover:brightness-110 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    save
                  </span>
                  <span>{mutation.isPending ? copy.saving : copy.save}</span>
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* SECTION 2: Preferences & Regional Settings (CORE-01.26) */}
        <section
          aria-label="Workspace Preferences and Regional Settings"
          className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden"
        >
          <div className="p-5 border-b border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-title-lg text-title-lg text-on-surface">
                Preferences &amp; Regional Settings
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Configure trilingual display language, operational density, and telemetry preferences.
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border border-dashed border-amber-600/60 bg-amber-50/60 text-amber-900 text-[10px] font-bold uppercase tracking-wider self-start sm:self-center"
              title="Browser-persisted preferences"
            >
              [ PROVISIONAL V2 ]
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* Trilingual Interface Language Selector Cards */}
            <div>
              <label className="block text-label-md font-label-md uppercase text-on-surface mb-1">
                Workspace Language Selection
              </label>
              <p className="text-xs text-on-surface-variant mb-3">
                Select your preferred constitutional language for navigation rails, status chips, and statutory headers.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    {
                      code: "en" as const,
                      badge: "EN • DEFAULT",
                      title: "English",
                      sub: "International / Technical Cadastral Standard",
                    },
                    {
                      code: "si" as const,
                      badge: "SI • සිංහල",
                      title: "සිංහල",
                      sub: "ජාතික යටිතල පහසුකම් විධාන අතුරුමුහුණත",
                    },
                    {
                      code: "ta" as const,
                      badge: "TA • தமிழ்",
                      title: "தமிழ்",
                      sub: "தேசிய உள்கட்டமைப்பு கட்டளை இடைமுகம்",
                    },
                  ] as const
                ).map((lang) => {
                  const active = locale === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      lang={lang.code}
                      aria-pressed={active}
                      onClick={() => onLocaleChange(lang.code)}
                      className={
                        active
                          ? "text-left p-3.5 rounded border-2 border-secondary bg-secondary-fixed/25 relative transition-all shadow-2xs"
                          : "text-left p-3.5 rounded border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low hover:border-outline transition-all"
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            active
                              ? "text-xs font-bold uppercase font-mono text-secondary"
                              : "text-xs font-bold uppercase font-mono text-on-surface-variant"
                          }
                        >
                          {lang.badge}
                        </span>
                        {active ? (
                          <span className="w-4 h-4 rounded-full bg-secondary text-white flex items-center justify-center">
                            <span className="material-symbols-outlined text-[11px]">
                              check
                            </span>
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-outline-variant" />
                        )}
                      </div>
                      <div className="font-title-md text-title-md text-on-surface mt-1.5">
                        {lang.title}
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">
                        {lang.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operational Display & Telemetry Preferences */}
            <div className="pt-4 border-t border-outline-variant/25 space-y-3">
              <span className="block text-label-sm font-label-sm uppercase text-on-surface-variant">
                Display Density &amp; Telemetry Options
              </span>

              {/* Row 1: Table & Ledger Density */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded bg-surface-container-low/50 border border-outline-variant/30">
                <div>
                  <div className="text-xs font-semibold text-on-surface flex items-center gap-2">
                    <span>Display Density Configuration</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-container text-on-surface-variant rounded">
                      Local Browser
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Adjust row padding across Project Operations tables and RoadSync conflict queues.
                  </p>
                </div>
                <div className="flex items-center bg-surface-container-lowest p-0.5 rounded border border-outline-variant/50 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    aria-pressed={density === "standard"}
                    onClick={() => onDensityChange("standard")}
                    className={
                      density === "standard"
                        ? "px-2.5 py-1 text-[11px] font-bold rounded-xs bg-primary-container text-white"
                        : "px-2.5 py-1 text-[11px] font-medium text-on-surface-variant hover:text-on-surface"
                    }
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    aria-pressed={density === "dense"}
                    onClick={() => onDensityChange("dense")}
                    className={
                      density === "dense"
                        ? "px-2.5 py-1 text-[11px] font-bold rounded-xs bg-primary-container text-white"
                        : "px-2.5 py-1 text-[11px] font-medium text-on-surface-variant hover:text-on-surface"
                    }
                  >
                    Dense Map
                  </button>
                </div>
              </div>

              {/* Row 2: Reduced Motion / Telemetry Pulse */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded bg-surface-container-low/50 border border-outline-variant/30">
                <div>
                  <div className="text-xs font-semibold text-on-surface flex items-center gap-2">
                    <span>Reduced Motion Telemetry</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono border border-dashed border-outline-variant text-on-surface-variant rounded-xs uppercase">
                      [ ACCESSIBILITY ]
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Minimize pulsing radar rings and transition animations across GIS and dashboard surfaces.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reducedMotion}
                  onClick={() => onReducedMotionChange(!reducedMotion)}
                  className={`px-3 py-1 rounded text-[11px] font-bold border transition-colors shrink-0 self-start sm:self-center ${
                    reducedMotion
                      ? "bg-secondary text-white border-secondary"
                      : "bg-surface-container-lowest text-on-surface border-outline-variant/60 hover:bg-surface-container"
                  }`}
                >
                  {reducedMotion ? "Reduced Motion: ON" : "Standard Motion"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Institutional Governance & Audit Footnote Card */}
        <div className="bg-primary-container text-white rounded border border-white/10 p-5 shadow-ambient relative overflow-hidden">
          <div className="absolute inset-0 cad-grid-dark opacity-20 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-secondary-container shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">
                  admin_panel_settings
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-title-md text-title-md text-white">
                    Need Elevated Corridor Jurisdiction?
                  </h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-white/10 text-primary-fixed rounded-xs">
                    National Registry
                  </span>
                </div>
                <p className="text-xs text-primary-fixed-dim mt-1 max-w-xl leading-relaxed">
                  Agency scope assignments and statutory sign-off authority are governed by{" "}
                  <strong className="text-white">SUPER_ADMIN</strong> and{" "}
                  <strong className="text-white">GOV_ADMIN</strong> directory controllers.
                </p>
              </div>
            </div>
            <Link
              href="/admin/agencies"
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-colors self-start sm:self-center"
            >
              <span>View Agency Directory</span>
              <span className="material-symbols-outlined text-[14px]">
                arrow_forward
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
