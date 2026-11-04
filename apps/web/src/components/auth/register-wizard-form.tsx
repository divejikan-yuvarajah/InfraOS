"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";

import { getAuthRegisterCopy } from "@/lib/auth/messages";
import { loginPathForLocale } from "@/lib/auth/redirect";
import {
  evaluatePasswordStrength,
  fetchPublicInstitutions,
  registerStep1Schema,
  registerStep2Schema,
  registerStep3Schema,
  REQUESTED_RESPONSIBILITY_KEYS,
  STATUTORY_INSTITUTIONS,
  submitRegistrationWithAuthClient,
  type PublicInstitutionOption,
  type RegisterWizardValues,
  type RegistrationSubmissionOutcome,
  type RequestedResponsibilityKey,
} from "@/lib/auth/register-schema";
import type { AuthLocale } from "@/lib/auth/types";
import { publicHomePath, publicInfoPath } from "@/lib/landing/locales";

import { LiquidGlassInput } from "./liquid-glass-input";
import { PillButton } from "./pill-button";

type RegisterWizardFormProps = {
  locale: AuthLocale;
  initialStep?: 1 | 2 | 3;
};

const SURVEY_STATIONS = [
  { step: 1 as const, station: "STA 0+000" },
  { step: 2 as const, station: "STA 0+500" },
  { step: 3 as const, station: "STA 1+000" },
] as const;

export function RegisterWizardForm({
  locale,
  initialStep = 1,
}: RegisterWizardFormProps) {
  const copy = getAuthRegisterCopy(locale);
  const errorAlertId = useId();

  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [institutions, setInstitutions] = useState<PublicInstitutionOption[]>([
    ...STATUTORY_INSTITUTIONS,
  ]);
  const [orgQuery, setOrgQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [values, setValues] = useState<RegisterWizardValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationCode: "RDA",
    organizationName: "Road Development Authority",
    department: "",
    designation: "",
    requestedResponsibility: "PROJECT_MANAGEMENT",
    acceptedTerms: false,
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedOutcome, setCompletedOutcome] = useState<
    Extract<RegistrationSubmissionOutcome, { ok: true }> | null
  >(null);

  useEffect(() => {
    let active = true;
    fetchPublicInstitutions().then((list) => {
      if (active && list.length > 0) {
        setInstitutions(list);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const strength = evaluatePasswordStrength(values.password);
  const passwordsMatch =
    values.confirmPassword.length > 0 &&
    values.password === values.confirmPassword;

  const filteredInstitutions = institutions.filter((item) => {
    const q = orgQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.shortName ?? "").toLowerCase().includes(q)
    );
  });

  function updateField<K extends keyof RegisterWizardValues>(
    key: K,
    value: RegisterWizardValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSubmitError(null);
  }

  function handleStep1Continue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const parsed = registerStep1Schema.safeParse({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setValues((prev) => ({
      ...prev,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
    }));
    setStep(2);
  }

  function handleStep2Continue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const parsed = registerStep2Schema.safeParse({
      organizationCode: values.organizationCode,
      organizationName: values.organizationName,
      department: values.department,
      designation: values.designation,
      requestedResponsibility: values.requestedResponsibility || undefined,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    const matchedOrg = institutions.find(
      (item) => item.code === parsed.data.organizationCode,
    );
    setValues((prev) => ({
      ...prev,
      organizationCode: parsed.data.organizationCode,
      organizationName:
        matchedOrg?.name ?? prev.organizationName ?? parsed.data.organizationCode,
      department: parsed.data.department,
      designation: parsed.data.designation,
      requestedResponsibility: parsed.data.requestedResponsibility,
    }));
    setStep(3);
  }

  async function handleFinalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const step1Check = registerStep1Schema.safeParse(values);
    if (!step1Check.success) {
      setStep(1);
      return;
    }
    const step2Check = registerStep2Schema.safeParse(values);
    if (!step2Check.success) {
      setStep(2);
      return;
    }
    const step3Check = registerStep3Schema.safeParse({
      acceptedTerms: values.acceptedTerms,
    });
    if (!step3Check.success) {
      setFieldErrors({
        acceptedTerms:
          step3Check.error.issues[0]?.message ??
          "You must accept the institutional terms",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitRegistrationWithAuthClient({
        fullName: step1Check.data.fullName,
        email: step1Check.data.email,
        password: step1Check.data.password,
        organizationCode: step2Check.data.organizationCode,
        organizationName:
          values.organizationName || step2Check.data.organizationCode,
        department: step2Check.data.department,
        designation: step2Check.data.designation,
        requestedResponsibility: step2Check.data.requestedResponsibility,
        acceptedTerms: true,
      });

      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }

      setCompletedOutcome(result);
    } finally {
      setSubmitting(false);
    }
  }

  if (completedOutcome) {
    return (
      <div
        role="region"
        aria-live="polite"
        aria-label={copy.confirmation.title}
        className="space-y-3"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5">
          <CheckCircle2
            className="h-3.5 w-3.5 text-[#279541]"
            aria-hidden="true"
          />
          <span className="auth-stitch-mono text-[10px] font-bold uppercase tracking-wider text-[#279541]">
            {copy.confirmation.badge}
          </span>
        </div>

        <div>
          <h1 className="auth-login-title">{copy.confirmation.title}</h1>
          <p className="auth-login-subtitle">{copy.confirmation.subtitle}</p>
        </div>

        {/* Reference & Status Ledger Card */}
        <div className="rounded-xl border border-slate-200 bg-[#F2F4F6]/80 p-3">
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <dt className="text-[10.5px] font-medium text-slate-500">
                {copy.confirmation.referenceLabel}
              </dt>
              <dd className="auth-stitch-mono mt-0.5 text-xs font-bold text-slate-900">
                {completedOutcome.referenceCode}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] font-medium text-slate-500">
                {copy.confirmation.statusLabel}
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                <span className="h-2 w-2 rounded-full bg-[#FEB600]" />
                {copy.confirmation.statusValue}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] font-medium text-slate-500">
                {copy.confirmation.organizationLabel}
              </dt>
              <dd className="mt-0.5 text-xs font-semibold text-slate-900">
                {completedOutcome.organizationName}
              </dd>
            </div>
          </dl>
        </div>

        {/* Next Steps List */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            {copy.confirmation.nextStepsTitle}
          </h2>
          <ol className="mt-2 space-y-1.5 text-xs leading-snug text-slate-600">
            {copy.confirmation.nextSteps.map((item, idx) => (
              <li key={item} className="flex items-start gap-2">
                <span className="auth-stitch-mono flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9.5px] font-bold text-[#C43D00]">
                  0{idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        {completedOutcome.mode === "preview" ? (
          <div className="auth-login-banner flex items-start gap-2">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <span>{copy.confirmation.previewModeNote}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Link
            href={loginPathForLocale(locale)}
            className="auth-pill-btn--compact inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#FF5B00] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E05000]"
          >
            <span>{copy.confirmation.returnToSignIn}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={publicHomePath(locale)}
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {copy.confirmation.returnToPortal}
          </Link>
        </div>
      </div>
    );
  }

  const activeTitle =
    step === 1
      ? copy.step1.title
      : step === 2
        ? copy.step2.title
        : copy.step3.title;
  const activeSubtitle =
    step === 1
      ? copy.step1.subtitle
      : step === 2
        ? copy.step2.subtitle
        : copy.step3.subtitle;

  const progressWidth = step === 1 ? "0%" : step === 2 ? "50%" : "100%";

  return (
    <div className="space-y-2.5">
      {/* Eyebrow + Sign-In Link & THE SURVEY LINE 3-Station Stepper */}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFDBCE]/75 px-2.5 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5B00]" />
            <span className="auth-stitch-mono text-[10px] font-bold uppercase tracking-wider text-[#A83900]">
              CREATE YOUR INFRAOS ACCOUNT
            </span>
          </div>
          <p className="text-[11.5px] text-slate-600">
            {copy.alreadyHaveAccount}{" "}
            <Link
              href={loginPathForLocale(locale)}
              className="font-bold text-[#A83900] hover:text-[#FF5B00] hover:underline"
            >
              {copy.signInLink}
            </Link>
          </p>
        </div>

        <h1 className="auth-login-title">{activeTitle}</h1>
        <p className="auth-login-subtitle">{activeSubtitle}</p>

        {/* THE SURVEY LINE STEPPER: STA 0+000 -> STA 0+500 -> STA 1+000 */}
        <nav
          aria-label="Account registration survey stations"
          className="mt-2 rounded-xl border border-slate-200/90 bg-[#F8FAFC] px-3 py-2 shadow-2xs"
        >
          <ol className="relative flex items-center justify-between">
            {/* Continuous Survey Track */}
            <div
              className="pointer-events-none absolute top-1/2 right-8 left-8 h-[2px] -translate-y-1/2 bg-slate-200"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute top-1/2 left-8 h-[2px] -translate-y-1/2 bg-[#FF5B00] transition-all duration-300"
              style={{ width: `calc((100% - 4rem) * ${step === 1 ? 0 : step === 2 ? 0.5 : 1})` }}
              aria-hidden="true"
            />

            {SURVEY_STATIONS.map(({ step: stepNumber, station }) => {
              const isCurrent = step === stepNumber;
              const isDone = step > stepNumber;
              const label = copy.stepLabels[stepNumber - 1];
              return (
                <li
                  key={stepNumber}
                  aria-current={isCurrent ? "step" : undefined}
                  className="relative z-10 flex items-center gap-2 bg-[#F8FAFC] px-1.5"
                >
                  <span
                    className={`auth-stitch-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold transition-all ${
                      isCurrent
                        ? "bg-[#FF5B00] text-white ring-3 ring-[#FFDBCE]"
                        : isDone
                          ? "bg-[#279541] text-white"
                          : "border border-slate-300 bg-white text-slate-500"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      `0${stepNumber}`
                    )}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`auth-stitch-mono block text-[9.5px] font-bold uppercase tracking-wider ${
                        isCurrent
                          ? "text-[#A83900]"
                          : isDone
                            ? "text-[#279541]"
                            : "text-slate-400"
                      }`}
                    >
                      {station}
                    </span>
                    <span
                      className={`block truncate text-[11px] leading-tight font-semibold ${
                        isCurrent
                          ? "text-slate-900"
                          : isDone
                            ? "text-emerald-950"
                            : "text-slate-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          <span className="sr-only">Progress {progressWidth}</span>
        </nav>
      </div>

      {submitError ? (
        <div
          id={errorAlertId}
          role="alert"
          aria-live="assertive"
          className="auth-login-error flex items-start gap-2"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8C1F28]"
            aria-hidden="true"
          />
          <span>{submitError}</span>
        </div>
      ) : null}

      {/* ================================================================= */}
      {/* STEP 1 (STA 0+000): ACCOUNT DETAILS                               */}
      {/* ================================================================= */}
      {step === 1 ? (
        <form method="post" onSubmit={handleStep1Continue} noValidate className="space-y-2.5">
          {/* Statutory institutional identity verification notice */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200/90 bg-[#F8FAFC] px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#FFDBCE] text-[#A83900]">
              <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900">
                Statutory Institutional Identity Verification
              </p>
              <p className="text-[11px] leading-snug text-slate-600">
                Requests are validated under Gazette No. 2341/14 protocol for public
                infrastructure clearance.
              </p>
            </div>
            <span className="auth-stitch-mono hidden shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] leading-tight text-slate-600 sm:block">
              SEC-
              <br />
              CLASS-1
            </span>
          </div>

          {/* Row 1: Official Full Name & Official Agency Email */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <LiquidGlassInput
              id="reg-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              compact
              label={copy.step1.fullNameLabel}
              icon={<User className="h-4 w-4" />}
              placeholder={copy.step1.fullNamePlaceholder}
              value={values.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              error={fieldErrors.fullName}
            />

            <LiquidGlassInput
              id="reg-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              compact
              label={copy.step1.emailLabel}
              suffixBadge=".gov.lk / .rda.lk"
              icon={<Mail className="h-4 w-4" />}
              placeholder={copy.step1.emailPlaceholder}
              value={values.email}
              onChange={(e) => updateField("email", e.target.value)}
              error={fieldErrors.email}
            />
          </div>

          {!fieldErrors.email ? (
            <p className="-mt-1 text-[11px] text-slate-500">
              {copy.step1.emailHelper}
            </p>
          ) : null}

          {/* Row 2: Access Password & Confirm Access Password */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <LiquidGlassInput
              id="reg-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              compact
              label={copy.step1.passwordLabel}
              icon={<KeyRound className="h-4 w-4" />}
              placeholder={copy.step1.passwordPlaceholder}
              value={values.password}
              onChange={(e) => updateField("password", e.target.value)}
              error={fieldErrors.password}
              rightLabelSlot={
                <span
                  className={`auth-stitch-mono inline-flex items-center gap-1 text-[10px] font-bold ${
                    strength.score >= 3
                      ? "text-[#279541]"
                      : strength.score === 2
                        ? "text-amber-700"
                        : "text-slate-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      strength.score >= 3
                        ? "bg-[#279541]"
                        : strength.score === 2
                          ? "bg-[#FEB600]"
                          : "bg-slate-300"
                    }`}
                  />
                  {copy.step1.strengthLabels[strength.score]}
                  {strength.score === 4 ? " (94%)" : ""}
                </span>
              }
              trailingControl={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
            />

            <LiquidGlassInput
              id="reg-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              compact
              label={copy.step1.confirmPasswordLabel}
              icon={<Lock className="h-4 w-4" />}
              placeholder={copy.step1.confirmPasswordPlaceholder}
              value={values.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              error={fieldErrors.confirmPassword}
              rightLabelSlot={
                passwordsMatch ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#279541]">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    <span>Matched</span>
                  </span>
                ) : null
              }
              trailingControl={
                <div className="flex items-center gap-1">
                  {passwordsMatch ? (
                    <CheckCircle2
                      className="h-4 w-4 text-[#279541]"
                      aria-label="Passwords match"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-pressed={showConfirmPassword}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              }
            />
          </div>

          {/* 4-Bar Strength Meter + Statutory Cryptographic Standards Checklist */}
          <div className="rounded-xl border border-slate-200/80 bg-[#F8FAFC] p-2.5">
            <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((bar) => {
                const active = strength.score >= bar;
                const tone =
                  strength.score <= 1
                    ? "bg-[#8C1F28]"
                    : strength.score === 2
                      ? "bg-[#FEB600]"
                      : "bg-[#279541]";
                return (
                  <span
                    key={bar}
                    className={`h-1.5 rounded-full transition-colors ${
                      active ? tone : "bg-slate-200"
                    }`}
                  />
                );
              })}
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-1 text-[10.5px] text-slate-600 sm:grid-cols-2">
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    strength.meetsMinLength ? "bg-[#279541]" : "bg-slate-300"
                  }`}
                />
                <span>{copy.step1.ruleMinLength}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    strength.withinMaxBytes ? "bg-[#279541]" : "bg-[#8C1F28]"
                  }`}
                />
                <span>{copy.step1.ruleMaxBytes}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    strength.hasLetterAndNumber ? "bg-[#279541]" : "bg-slate-300"
                  }`}
                />
                <span>{copy.step1.ruleAlphanumeric}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    strength.hasMixedCaseOrSymbol
                      ? "bg-[#279541]"
                      : "bg-slate-300"
                  }`}
                />
                <span>{copy.step1.ruleComplex}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 pt-0.5 sm:flex-row">
            <span className="hidden min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-500 sm:inline-flex">
              <ShieldCheck
                className="h-3.5 w-3.5 shrink-0 text-[#279541]"
                aria-hidden="true"
              />
              <span className="truncate">Encrypted via TLS 1.3 Statutory Channel</span>
            </span>
            <PillButton
              type="submit"
              compact
              className="shrink-0 whitespace-nowrap sm:w-auto sm:px-6"
            >
              <span>{copy.step1.continueBtn}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </PillButton>
          </div>
        </form>
      ) : null}

      {/* ================================================================= */}
      {/* STEP 2 (STA 0+500): ORGANIZATION & ACCESS                         */}
      {/* ================================================================= */}
      {step === 2 ? (
        <form onSubmit={handleStep2Continue} noValidate className="space-y-2">
          {/* Searchable Organization Selector in Compact Row */}
          <div className="auth-login-field">
            <label htmlFor="reg-organization" className="mb-1">
              {copy.step2.organizationLabel}{" "}
              <span className="font-bold text-[#FF5B00]">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[0.85fr_1.15fr]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={orgQuery}
                  onChange={(e) => setOrgQuery(e.target.value)}
                  placeholder={copy.step2.organizationSearchPlaceholder}
                  aria-label={copy.step2.organizationSearchPlaceholder}
                  className="h-9.5 w-full rounded-xl border border-slate-200 bg-slate-50 pr-2.5 pl-8.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#FF5B00] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="relative">
                <Building2
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <select
                  id="reg-organization"
                  name="organizationCode"
                  required
                  value={values.organizationCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const found = institutions.find((item) => item.code === code);
                    updateField("organizationCode", code);
                    updateField("organizationName", found?.name ?? code);
                  }}
                  aria-invalid={fieldErrors.organizationCode ? "true" : "false"}
                  className="h-9.5 w-full rounded-xl border border-slate-300 bg-white pr-7 pl-9 text-xs font-medium text-slate-900 focus:border-[#FF5B00] focus:ring-2 focus:ring-[#FF5B00]/20 focus:outline-none"
                >
                  {filteredInstitutions.map((inst) => (
                    <option key={inst.code} value={inst.code}>
                      {inst.shortName ? `${inst.shortName} — ` : ""}
                      {inst.name} ({inst.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {fieldErrors.organizationCode ? (
              <p className="mt-1 text-[11px] font-medium text-[#8C1F28]">
                {fieldErrors.organizationCode}
              </p>
            ) : null}
          </div>

          {/* Department / Division & Professional Designation */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="auth-login-field">
              <label htmlFor="reg-department" className="mb-1">
                {copy.step2.departmentLabel}{" "}
                <span className="font-bold text-[#FF5B00]">*</span>
              </label>
              <input
                id="reg-department"
                name="department"
                type="text"
                required
                placeholder={copy.step2.departmentPlaceholder}
                value={values.department}
                onChange={(e) => updateField("department", e.target.value)}
                aria-invalid={fieldErrors.department ? "true" : "false"}
                className={`h-9.5 w-full rounded-xl border bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.department
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
              {fieldErrors.department ? (
                <p className="mt-1 text-[11px] font-medium text-[#8C1F28]">
                  {fieldErrors.department}
                </p>
              ) : null}
            </div>

            <div className="auth-login-field">
              <label htmlFor="reg-designation" className="mb-1">
                {copy.step2.designationLabel}{" "}
                <span className="font-bold text-[#FF5B00]">*</span>
              </label>
              <input
                id="reg-designation"
                name="designation"
                type="text"
                autoComplete="organization-title"
                required
                placeholder={copy.step2.designationPlaceholder}
                value={values.designation}
                onChange={(e) => updateField("designation", e.target.value)}
                aria-invalid={fieldErrors.designation ? "true" : "false"}
                className={`h-9.5 w-full rounded-xl border bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.designation
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
              {fieldErrors.designation ? (
                <p className="mt-1 text-[11px] font-medium text-[#8C1F28]">
                  {fieldErrors.designation}
                </p>
              ) : null}
            </div>
          </div>

          {/* Requested Access Responsibility */}
          <fieldset className="auth-login-field">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
              <legend className="text-xs font-semibold text-slate-900">
                {copy.step2.responsibilityLabel}{" "}
                <span className="font-bold text-[#FF5B00]">*</span>
              </legend>
              <span className="text-[10px] text-slate-500">
                {copy.step2.responsibilityHelper}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {REQUESTED_RESPONSIBILITY_KEYS.map((key) => {
                const selected = values.requestedResponsibility === key;
                const item = copy.step2.responsibilities[key];
                return (
                  <label
                    key={key}
                    className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${
                      selected
                        ? "border-[#FF5B00] bg-orange-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="requestedResponsibility"
                      value={key}
                      checked={selected}
                      onChange={() =>
                        updateField(
                          "requestedResponsibility",
                          key as RequestedResponsibilityKey,
                        )
                      }
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#FF5B00]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-slate-900">
                        {item.label}
                      </span>
                      <span className="block truncate text-[10px] leading-tight text-slate-500">
                        {item.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {fieldErrors.requestedResponsibility ? (
              <p className="mt-1 text-[11px] font-medium text-[#8C1F28]">
                {fieldErrors.requestedResponsibility}
              </p>
            ) : null}
          </fieldset>

          {/* Mandatory Institutional Access Callout */}
          <div
            role="note"
            className="rounded-xl border border-amber-300/80 bg-amber-50/80 px-2.5 py-1.5 text-[10.5px] text-amber-950"
          >
            <div className="flex items-start gap-2">
              <ShieldAlert
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C43D00]"
                aria-hidden="true"
              />
              <p className="leading-snug text-slate-700">
                <strong className="font-bold text-slate-900">
                  {copy.step2.institutionalNoticeTitle}:{" "}
                </strong>
                {copy.step2.institutionalNoticeBody}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-0.5 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.step2.previousBtn}</span>
            </button>
            <PillButton type="submit" compact className="flex-1">
              <span>{copy.step2.continueBtn}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PillButton>
          </div>
        </form>
      ) : null}

      {/* ================================================================= */}
      {/* STEP 3 (STA 1+000): REVIEW & ACCOUNT SUBMISSION                   */}
      {/* ================================================================= */}
      {step === 3 ? (
        <form method="post" onSubmit={handleFinalSubmit} noValidate className="space-y-2.5">
          {/* Summary Card 1: Personal & Security Credentials */}
          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="auth-stitch-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-700">
                {copy.step3.accountSectionTitle}
              </h2>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A83900] hover:text-[#FF5B00] hover:underline"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                <span>{copy.step3.editBtn}</span>
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-[10.5px] text-slate-500">
                  {copy.step1.fullNameLabel}
                </dt>
                <dd className="truncate font-semibold text-slate-900">
                  {values.fullName}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">
                  {copy.step1.emailLabel}
                </dt>
                <dd className="auth-stitch-mono truncate font-semibold text-slate-900">
                  {values.email}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">
                  {copy.step1.passwordLabel}
                </dt>
                <dd className="truncate text-[11px] font-medium text-slate-600">
                  {copy.step3.passwordProtectedMask}
                </dd>
              </div>
            </dl>
          </div>

          {/* Summary Card 2: Institutional Affiliation & Scope */}
          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="auth-stitch-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-700">
                {copy.step3.organizationSectionTitle}
              </h2>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A83900] hover:text-[#FF5B00] hover:underline"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                <span>{copy.step3.editBtn}</span>
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[10.5px] text-slate-500">
                  {copy.step2.organizationLabel}
                </dt>
                <dd className="truncate font-semibold text-slate-900">
                  {values.organizationName} ({values.organizationCode})
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">
                  {copy.step2.responsibilityLabel}
                </dt>
                <dd className="truncate font-semibold text-[#A83900]">
                  {values.requestedResponsibility
                    ? copy.step2.responsibilities[values.requestedResponsibility]
                        .label
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">
                  {copy.step2.departmentLabel}
                </dt>
                <dd className="truncate font-semibold text-slate-900">
                  {values.department}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">
                  {copy.step2.designationLabel}
                </dt>
                <dd className="truncate font-semibold text-slate-900">
                  {values.designation}
                </dd>
              </div>
            </dl>
          </div>

          {/* Mandatory Institutional Access Callout */}
          <div
            role="note"
            className="rounded-xl border border-amber-300/80 bg-amber-50/80 px-3 py-2 text-[11px] leading-snug text-slate-700"
          >
            <strong className="font-semibold text-slate-900">
              {copy.step2.institutionalNoticeTitle}:{" "}
            </strong>
            {copy.step2.institutionalNoticeBody}
          </div>

          {/* Governance & Privacy Acceptance */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
            <label className="flex cursor-pointer items-start gap-2 text-[11.5px] leading-snug text-slate-700">
              <input
                id="reg-accept-terms"
                name="acceptedTerms"
                type="checkbox"
                checked={values.acceptedTerms}
                onChange={(e) => updateField("acceptedTerms", e.target.checked)}
                aria-invalid={fieldErrors.acceptedTerms ? "true" : "false"}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#FF5B00]"
              />
              <span>
                {copy.step3.termsCheckboxLabel}{" "}
                <Link
                  href={publicInfoPath(locale, "privacy")}
                  className="font-semibold text-[#A83900] underline hover:text-[#FF5B00]"
                >
                  {copy.step3.privacyPolicyLink}
                </Link>{" "}
                &amp;{" "}
                <Link
                  href={publicInfoPath(locale, "accessibility")}
                  className="font-semibold text-[#A83900] underline hover:text-[#FF5B00]"
                >
                  {copy.step3.accessibilityLink}
                </Link>
                .
              </span>
            </label>
            {fieldErrors.acceptedTerms ? (
              <p className="mt-1 text-[11px] font-medium text-[#8C1F28]">
                {fieldErrors.acceptedTerms}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-0.5 sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(2)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.step3.previousBtn}</span>
            </button>
            <PillButton type="submit" compact disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{copy.step3.submittingBtn}</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  <span>{copy.step3.submitBtn}</span>
                </>
              )}
            </PillButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
