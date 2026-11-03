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
  Loader2,
  Lock,
  Mail,
  Pencil,
  Search,
  ShieldAlert,
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

type RegisterWizardFormProps = {
  locale: AuthLocale;
  initialStep?: 1 | 2 | 3;
};

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
        className="space-y-5"
      >
        <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1">
          <CheckCircle2 className="h-4 w-4 text-[#279541]" aria-hidden="true" />
          <span className="auth-stitch-mono text-[10.5px] font-bold uppercase tracking-wider text-[#279541]">
            {copy.confirmation.badge}
          </span>
        </div>

        <div>
          <h1 className="auth-login-title">{copy.confirmation.title}</h1>
          <p className="auth-login-subtitle">{copy.confirmation.subtitle}</p>
        </div>

        {/* Reference & Status Ledger Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-medium text-slate-500">
                {copy.confirmation.referenceLabel}
              </dt>
              <dd className="auth-stitch-mono mt-0.5 text-sm font-bold text-slate-900">
                {completedOutcome.referenceCode}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">
                {copy.confirmation.statusLabel}
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <span className="h-2 w-2 rounded-full bg-[#FEB600]" />
                {copy.confirmation.statusValue}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">
                {copy.confirmation.organizationLabel}
              </dt>
              <dd className="mt-0.5 text-xs font-semibold text-slate-900">
                {completedOutcome.organizationName}
              </dd>
            </div>
          </dl>
        </div>

        {/* Next Steps List */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {copy.confirmation.nextStepsTitle}
          </h2>
          <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-600">
            {copy.confirmation.nextSteps.map((item, idx) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="auth-stitch-mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-[#C43D00]">
                  0{idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        {completedOutcome.mode === "preview" ? (
          <div className="auth-login-banner flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>{copy.confirmation.previewModeNote}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
          <Link
            href={loginPathForLocale(locale)}
            className="auth-primary-cta inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold"
          >
            <span>{copy.confirmation.returnToSignIn}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={publicHomePath(locale)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
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

  return (
    <div className="space-y-5">
      {/* Eyebrow & Step Progress Rail */}
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-slate-200/90 bg-slate-100/90 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5B00]" />
          <span className="auth-stitch-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-700">
            {copy.eyebrow}
          </span>
        </div>

        {/* 3-Step Horizontal Stepper */}
        <nav aria-label="Account registration steps" className="mb-5">
          <ol className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((stepNumber) => {
              const isCurrent = step === stepNumber;
              const isDone = step > stepNumber;
              const label = copy.stepLabels[stepNumber - 1];
              return (
                <li
                  key={stepNumber}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`rounded-lg border px-2.5 py-2 transition-colors ${
                    isCurrent
                      ? "border-[#FF5B00] bg-orange-50/60"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`auth-stitch-mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isCurrent
                          ? "bg-[#FF5B00] text-white"
                          : isDone
                            ? "bg-[#279541] text-white"
                            : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        `0${stepNumber}`
                      )}
                    </span>
                    <span
                      className={`truncate text-[11px] font-semibold ${
                        isCurrent
                          ? "text-slate-900"
                          : isDone
                            ? "text-emerald-900"
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
        </nav>

        <h1 className="auth-login-title">{activeTitle}</h1>
        <p className="auth-login-subtitle">{activeSubtitle}</p>
      </div>

      {submitError ? (
        <div
          id={errorAlertId}
          role="alert"
          aria-live="assertive"
          className="auth-login-error flex items-start gap-2.5"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#8C1F28]"
            aria-hidden="true"
          />
          <span>{submitError}</span>
        </div>
      ) : null}

      {/* STEP 1: ACCOUNT DETAILS */}
      {step === 1 ? (
        <form onSubmit={handleStep1Continue} noValidate className="space-y-4">
          {/* Full Name */}
          <div className="auth-login-field">
            <label htmlFor="reg-full-name">
              {copy.step1.fullNameLabel} <span className="text-[#8C1F28]">*</span>
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="reg-full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                placeholder={copy.step1.fullNamePlaceholder}
                value={values.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                aria-invalid={fieldErrors.fullName ? "true" : "false"}
                className={`h-11 w-full rounded-lg border bg-white pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.fullName
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
            </div>
            {fieldErrors.fullName ? (
              <p className="mt-1 text-xs font-medium text-[#8C1F28]">
                {fieldErrors.fullName}
              </p>
            ) : null}
          </div>

          {/* Work Email Address */}
          <div className="auth-login-field">
            <label htmlFor="reg-email">
              {copy.step1.emailLabel} <span className="text-[#8C1F28]">*</span>
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="reg-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder={copy.step1.emailPlaceholder}
                value={values.email}
                onChange={(e) => updateField("email", e.target.value)}
                aria-invalid={fieldErrors.email ? "true" : "false"}
                className={`h-11 w-full rounded-lg border bg-white pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.email
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
            </div>
            {fieldErrors.email ? (
              <p className="mt-1 text-xs font-medium text-[#8C1F28]">
                {fieldErrors.email}
              </p>
            ) : (
              <p className="mt-1 text-[11.5px] text-slate-500">
                {copy.step1.emailHelper}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="auth-login-field">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="reg-password" className="mb-0">
                {copy.step1.passwordLabel} <span className="text-[#8C1F28]">*</span>
              </label>
              <span className="auth-stitch-mono text-[11px] font-medium text-slate-500">
                {copy.step1.strengthLabels[strength.score]}
              </span>
            </div>
            <div className="auth-login-password-row">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="reg-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder={copy.step1.passwordPlaceholder}
                value={values.password}
                onChange={(e) => updateField("password", e.target.value)}
                aria-invalid={fieldErrors.password ? "true" : "false"}
                className={`h-11 w-full rounded-lg border bg-white pr-12 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.password
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="auth-login-password-toggle inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* 4-Segment Strength Bar */}
            <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
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

            {fieldErrors.password ? (
              <p className="mt-1.5 text-xs font-medium text-[#8C1F28]">
                {fieldErrors.password}
              </p>
            ) : null}

            {/* Real-Time Password Policy Checklist */}
            <ul className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    strength.meetsMinLength ? "bg-[#279541]" : "bg-slate-300"
                  }`}
                />
                <span>{copy.step1.ruleMinLength}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    strength.withinMaxBytes ? "bg-[#279541]" : "bg-[#8C1F28]"
                  }`}
                />
                <span>{copy.step1.ruleMaxBytes}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    strength.hasLetterAndNumber ? "bg-[#279541]" : "bg-slate-300"
                  }`}
                />
                <span>{copy.step1.ruleAlphanumeric}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    strength.hasMixedCaseOrSymbol ? "bg-[#279541]" : "bg-slate-300"
                  }`}
                />
                <span>{copy.step1.ruleComplex}</span>
              </li>
            </ul>
          </div>

          {/* Confirm Password */}
          <div className="auth-login-field">
            <label htmlFor="reg-confirm-password">
              {copy.step1.confirmPasswordLabel}{" "}
              <span className="text-[#8C1F28]">*</span>
            </label>
            <div className="auth-login-password-row">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="reg-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder={copy.step1.confirmPasswordPlaceholder}
                value={values.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
                className={`h-11 w-full rounded-lg border bg-white pr-12 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.confirmPassword
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-pressed={showConfirmPassword}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                className="auth-login-password-toggle inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword ? (
              <p className="mt-1 text-xs font-medium text-[#8C1F28]">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="auth-primary-cta inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold"
            >
              <span>{copy.step1.continueBtn}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="pt-1 text-center text-xs text-slate-600">
            {copy.alreadyHaveAccount}{" "}
            <Link
              href={loginPathForLocale(locale)}
              className="font-bold text-[#C43D00] hover:text-[#FF5B00] hover:underline"
            >
              {copy.signInLink}
            </Link>
          </p>
        </form>
      ) : null}

      {/* STEP 2: ORGANIZATION & ACCESS */}
      {step === 2 ? (
        <form onSubmit={handleStep2Continue} noValidate className="space-y-4">
          {/* Searchable Organization Selector */}
          <div className="auth-login-field">
            <label htmlFor="reg-organization">
              {copy.step2.organizationLabel}{" "}
              <span className="text-[#8C1F28]">*</span>
            </label>
            <div className="space-y-2">
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
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#FF5B00] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="relative">
                <Building2
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
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
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white pr-8 pl-10 text-sm font-medium text-slate-900 focus:border-[#FF5B00] focus:ring-2 focus:ring-[#FF5B00]/20 focus:outline-none"
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
              <p className="mt-1 text-xs font-medium text-[#8C1F28]">
                {fieldErrors.organizationCode}
              </p>
            ) : null}
          </div>

          {/* Department / Division & Professional Designation */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="auth-login-field">
              <label htmlFor="reg-department">
                {copy.step2.departmentLabel}{" "}
                <span className="text-[#8C1F28]">*</span>
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
                className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.department
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
              {fieldErrors.department ? (
                <p className="mt-1 text-xs font-medium text-[#8C1F28]">
                  {fieldErrors.department}
                </p>
              ) : null}
            </div>

            <div className="auth-login-field">
              <label htmlFor="reg-designation">
                {copy.step2.designationLabel}{" "}
                <span className="text-[#8C1F28]">*</span>
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
                className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none ${
                  fieldErrors.designation
                    ? "border-[#8C1F28] focus:border-[#8C1F28] focus:ring-[#8C1F28]/20"
                    : "border-slate-300 focus:border-[#FF5B00] focus:ring-[#FF5B00]/20"
                }`}
              />
              {fieldErrors.designation ? (
                <p className="mt-1 text-xs font-medium text-[#8C1F28]">
                  {fieldErrors.designation}
                </p>
              ) : null}
            </div>
          </div>

          {/* Requested Access Responsibility */}
          <fieldset className="auth-login-field">
            <legend className="mb-1 text-[13px] font-semibold text-slate-800">
              {copy.step2.responsibilityLabel}{" "}
              <span className="text-[#8C1F28]">*</span>
            </legend>
            <p className="mb-2.5 text-[11.5px] text-slate-500">
              {copy.step2.responsibilityHelper}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REQUESTED_RESPONSIBILITY_KEYS.map((key) => {
                const selected = values.requestedResponsibility === key;
                const item = copy.step2.responsibilities[key];
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
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
                      className="mt-0.5 h-3.5 w-3.5 accent-[#FF5B00]"
                    />
                    <span className="block">
                      <span className="block text-xs font-semibold text-slate-900">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                        {item.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {fieldErrors.requestedResponsibility ? (
              <p className="mt-1.5 text-xs font-medium text-[#8C1F28]">
                {fieldErrors.requestedResponsibility}
              </p>
            ) : null}
          </fieldset>

          {/* Mandatory Institutional Access Callout */}
          <div
            role="note"
            className="rounded-xl border border-amber-300/80 bg-amber-50/80 p-3.5 text-xs text-amber-950"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-[#C43D00]"
                aria-hidden="true"
              />
              <div>
                <p className="font-bold text-slate-900">
                  {copy.step2.institutionalNoticeTitle}
                </p>
                <p className="mt-0.5 leading-relaxed text-slate-700">
                  {copy.step2.institutionalNoticeBody}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.step2.previousBtn}</span>
            </button>
            <button
              type="submit"
              className="auth-primary-cta inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold"
            >
              <span>{copy.step2.continueBtn}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : null}

      {/* STEP 3: REVIEW & ACCOUNT SUBMISSION */}
      {step === 3 ? (
        <form onSubmit={handleFinalSubmit} noValidate className="space-y-4">
          {/* Summary Card 1: Personal & Security Credentials */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="auth-stitch-mono text-xs font-bold uppercase tracking-wider text-slate-700">
                {copy.step3.accountSectionTitle}
              </h2>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#C43D00] hover:text-[#FF5B00] hover:underline"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                <span>{copy.step3.editBtn}</span>
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[11px] text-slate-500">
                  {copy.step1.fullNameLabel}
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {values.fullName}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">
                  {copy.step1.emailLabel}
                </dt>
                <dd className="auth-stitch-mono mt-0.5 font-semibold text-slate-900">
                  {values.email}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] text-slate-500">
                  {copy.step1.passwordLabel}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-600">
                  {copy.step3.passwordProtectedMask}
                </dd>
              </div>
            </dl>
          </div>

          {/* Summary Card 2: Institutional Affiliation & Scope */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="auth-stitch-mono text-xs font-bold uppercase tracking-wider text-slate-700">
                {copy.step3.organizationSectionTitle}
              </h2>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#C43D00] hover:text-[#FF5B00] hover:underline"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                <span>{copy.step3.editBtn}</span>
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-[11px] text-slate-500">
                  {copy.step2.organizationLabel}
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {values.organizationName} ({values.organizationCode})
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">
                  {copy.step2.departmentLabel}
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {values.department}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">
                  {copy.step2.designationLabel}
                </dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {values.designation}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] text-slate-500">
                  {copy.step2.responsibilityLabel}
                </dt>
                <dd className="mt-0.5 font-semibold text-[#C43D00]">
                  {values.requestedResponsibility
                    ? copy.step2.responsibilities[values.requestedResponsibility]
                        .label
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Mandatory Institutional Access Callout */}
          <div
            role="note"
            className="rounded-xl border border-amber-300/80 bg-amber-50/80 p-3 text-[11.5px] leading-relaxed text-slate-700"
          >
            <strong className="font-semibold text-slate-900">
              {copy.step2.institutionalNoticeTitle}:{" "}
            </strong>
            {copy.step2.institutionalNoticeBody}
          </div>

          {/* Governance & Privacy Acceptance */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-700">
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
                  className="font-semibold text-[#C43D00] underline hover:text-[#FF5B00]"
                >
                  {copy.step3.privacyPolicyLink}
                </Link>{" "}
                &amp;{" "}
                <Link
                  href={publicInfoPath(locale, "accessibility")}
                  className="font-semibold text-[#C43D00] underline hover:text-[#FF5B00]"
                >
                  {copy.step3.accessibilityLink}
                </Link>
                .
              </span>
            </label>
            {fieldErrors.acceptedTerms ? (
              <p className="mt-1.5 text-xs font-medium text-[#8C1F28]">
                {fieldErrors.acceptedTerms}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(2)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.step3.previousBtn}</span>
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="auth-primary-cta inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold"
            >
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
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

