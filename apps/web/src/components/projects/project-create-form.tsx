"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { projectCreateFormSchema } from "@/lib/projects/create-schema";
import { shouldConfirmDiscard, type CreateFailure } from "@/lib/projects/create-outcome";
import {
  buildProjectCreateBody,
  createControlId,
  createErrorId,
  normalizeProjectCode,
  PROJECT_TYPE_VALUES,
  type CreateField,
  type CreateIssue,
  type ProjectCreateFormValues,
  type ProjectCreateRequest,
} from "@/lib/projects/create-transform";
import type { ProjectCopy } from "@/lib/projects/messages";

const DRAFT_KEY = "infraos:project-create-draft:v1";

const EMPTY: ProjectCreateFormValues = {
  projectCode: "",
  title: "",
  projectType: "",
  description: "",
  startDate: "",
  plannedEndDate: "",
  amountLkr: "",
  province: "",
  district: "",
  locality: "",
  roadName: "",
  locationDescription: "",
  longitude: "",
  latitude: "",
};

function readDraft(): Partial<ProjectCreateFormValues> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Partial<ProjectCreateFormValues>) : null;
  } catch {
    return null;
  }
}

function writeDraft(values: ProjectCreateFormValues): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  } catch {
    // Ignore storage quota or private-browsing errors.
  }
}

function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function formatLkrPreview(raw: string): string | null {
  const cleaned = raw.replaceAll(",", "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return `LKR ${new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)}`;
}

function issueText(copy: ProjectCopy, issue: string | undefined): string | undefined {
  if (!issue) return undefined;
  const known = copy.errors[issue as CreateIssue];
  return known ?? copy.errors.format;
}

export function ProjectCreateForm({
  copy,
  failure,
  pending,
  onSubmitBody,
  onCancel,
  agencyChoice = null,
}: {
  copy: ProjectCopy;
  failure: CreateFailure | null;
  pending: boolean;
  onSubmitBody: (body: ProjectCreateRequest) => Promise<void>;
  onCancel: () => void;
  /** Set only for platform administrators, who must pick the owning agency. */
  agencyChoice?: { options: { id: string; label: string }[]; unavailable: boolean } | null;
}) {
  const pendingRef = useRef(false);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  const [restored, setRestored] = useState(false);
  const form = useForm<ProjectCreateFormValues>({
    defaultValues: EMPTY,
    resolver: zodResolver(projectCreateFormSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    const draft = readDraft();
    if (draft && Object.values(draft).some((v) => typeof v === "string" && v.trim().length > 0)) {
      form.reset({ ...EMPTY, ...draft });
      setRestored(true);
    }
  }, [form]);

  const watched = form.watch();
  const codePreview = normalizeProjectCode(watched.projectCode ?? "");
  const budgetPreview = formatLkrPreview(watched.amountLkr ?? "");
  const dirty = form.formState.isDirty;

  useEffect(() => {
    if (!dirty) return;
    const handle = window.setTimeout(() => writeDraft(form.getValues()), 400);
    return () => window.clearTimeout(handle);
  }, [dirty, form, watched]);

  useEffect(() => {
    if (failure) bannerRef.current?.focus();
  }, [failure]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!shouldConfirmDiscard(dirty, false)) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const failureText = failure ? copy.errors[failure] : null;

  const field = (name: CreateField, label: string, control: ReactNode, hint?: string) => {
    const message = issueText(copy, form.formState.errors[name]?.message);
    const errorId = createErrorId(name);
    const hintId = hint ? `${createControlId(name)}-hint` : undefined;
    return (
      <div>
        <label className="auth-access-field-label" htmlFor={createControlId(name)}>
          {label}
        </label>
        {control}
        {hint ? (
          <p className="auth-access-hint" id={hintId}>
            {hint}
          </p>
        ) : null}
        {message ? (
          <p className="project-create-error" id={errorId} role="alert">
            {message}
          </p>
        ) : null}
      </div>
    );
  };

  const describedBy = (name: CreateField, hint?: boolean) => {
    const parts = [];
    if (hint) parts.push(`${createControlId(name)}-hint`);
    if (form.formState.errors[name]) parts.push(createErrorId(name));
    return parts.length > 0 ? parts.join(" ") : undefined;
  };

  const sections = [
    { id: "create-identity", step: "01", label: copy.sectionIdentity },
    { id: "create-planning", step: "02", label: copy.sectionPlanning },
    { id: "create-funding", step: "03", label: copy.sectionFunding },
    { id: "create-place", step: "04", label: copy.sectionPlace },
    { id: "create-summary", step: "05", label: copy.summaryTitle },
  ];

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (pendingRef.current || pending) return;
        if (agencyChoice && !values.agencyId) {
          form.setError("agencyId", { type: "custom", message: "required" });
          document.getElementById(createControlId("agencyId"))?.focus();
          return;
        }
        const built = buildProjectCreateBody(values);
        if (!built.ok) return;
        pendingRef.current = true;
        void onSubmitBody(built.body)
          .then(() => {
            clearDraft();
          })
          .catch(() => undefined)
          .finally(() => {
            pendingRef.current = false;
          });
      }, (errors) => {
        const first = Object.keys(errors)[0] as CreateField | undefined;
        if (first) document.getElementById(createControlId(first))?.focus();
      })}
    >
      {/* Guided section stepper */}
      <nav aria-label="Form sections" className="cac-card sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700 hover:border-[#ff5b00] hover:text-[#9a3412]"
              >
                <span className="font-mono text-[10px] font-bold text-[#ff5b00]">{s.step}</span>
                <span>{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
        {restored ? (
          <div className="flex items-center gap-2 text-xs text-slate-600" role="status">
            <span>Draft restored</span>
            <button
              type="button"
              className="underline font-semibold text-slate-900"
              onClick={() => {
                clearDraft();
                form.reset(EMPTY);
                setRestored(false);
              }}
            >
              Clear
            </button>
          </div>
        ) : null}
      </nav>

      <div className="project-create-grid">
        <div className="project-create-fields space-y-5">
          <section className="cac-card p-5 space-y-4" aria-labelledby="create-identity">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="font-mono text-xs font-bold text-[#ff5b00]">01</span>
              <h2 id="create-identity" className="text-base font-semibold text-slate-900">{copy.sectionIdentity}</h2>
            </div>
            <div className="project-create-fields">
              {agencyChoice
                ? field(
                    "agencyId",
                    copy.fieldAgency,
                    <select
                      id={createControlId("agencyId")}
                      className="auth-access-input"
                      aria-invalid={Boolean(form.formState.errors.agencyId)}
                      aria-describedby={describedBy("agencyId", true)}
                      disabled={agencyChoice.unavailable}
                      {...form.register("agencyId")}
                    >
                      <option value="">{copy.agencyPlaceholder}</option>
                      {agencyChoice.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>,
                    agencyChoice.unavailable ? copy.agencyUnavailable : copy.agencyHint,
                  )
                : null}
              {field(
                "projectCode",
                copy.fieldCode,
                <input
                  id={createControlId("projectCode")}
                  className="auth-access-input font-mono"
                  autoComplete="off"
                  aria-invalid={Boolean(form.formState.errors.projectCode)}
                  aria-describedby={describedBy("projectCode", true)}
                  {...form.register("projectCode")}
                />,
                copy.codeHint,
              )}
              {field(
                "title",
                copy.fieldTitle,
                <input
                  id={createControlId("title")}
                  className="auth-access-input"
                  autoComplete="off"
                  maxLength={200}
                  aria-invalid={Boolean(form.formState.errors.title)}
                  aria-describedby={describedBy("title")}
                  {...form.register("title")}
                />,
              )}
              {field(
                "projectType",
                copy.fieldType,
                <select
                  id={createControlId("projectType")}
                  className="auth-access-input"
                  aria-invalid={Boolean(form.formState.errors.projectType)}
                  aria-describedby={describedBy("projectType")}
                  {...form.register("projectType")}
                >
                  <option value="">{copy.typePlaceholder}</option>
                  {PROJECT_TYPE_VALUES.map((type) => (
                    <option key={type} value={type}>
                      {copy.types[type]}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                "description",
                copy.fieldDescription,
                <textarea
                  id={createControlId("description")}
                  className="auth-access-input"
                  rows={4}
                  maxLength={5000}
                  aria-invalid={Boolean(form.formState.errors.description)}
                  aria-describedby={describedBy("description")}
                  {...form.register("description")}
                />,
              )}
            </div>
          </section>

          <section className="cac-card p-5 space-y-4" aria-labelledby="create-planning">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="font-mono text-xs font-bold text-[#ff5b00]">02</span>
              <h2 id="create-planning" className="text-base font-semibold text-slate-900">{copy.sectionPlanning}</h2>
            </div>
            <div className="project-create-pair">
              {field(
                "startDate",
                copy.fieldStart,
                <input
                  id={createControlId("startDate")}
                  className="auth-access-input"
                  type="date"
                  aria-invalid={Boolean(form.formState.errors.startDate)}
                  aria-describedby={describedBy("startDate")}
                  {...form.register("startDate")}
                />,
              )}
              {field(
                "plannedEndDate",
                copy.fieldEnd,
                <input
                  id={createControlId("plannedEndDate")}
                  className="auth-access-input"
                  type="date"
                  aria-invalid={Boolean(form.formState.errors.plannedEndDate)}
                  aria-describedby={describedBy("plannedEndDate")}
                  {...form.register("plannedEndDate")}
                />,
              )}
            </div>
          </section>

          <section className="cac-card p-5 space-y-4" aria-labelledby="create-funding">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#ff5b00]">03</span>
                <h2 id="create-funding" className="text-base font-semibold text-slate-900">{copy.sectionFunding}</h2>
              </div>
              {budgetPreview ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                  {budgetPreview}
                </span>
              ) : null}
            </div>
            {field(
              "amountLkr",
              copy.budgetLabel,
              <input
                id={createControlId("amountLkr")}
                className="auth-access-input font-mono tabular-nums"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.amountLkr)}
                aria-describedby={describedBy("amountLkr", true)}
                {...form.register("amountLkr")}
              />,
              copy.budgetHint,
            )}
          </section>

          <section className="cac-card p-5 space-y-4" aria-labelledby="create-place">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="font-mono text-xs font-bold text-[#ff5b00]">04</span>
              <h2 id="create-place" className="text-base font-semibold text-slate-900">{copy.sectionPlace}</h2>
            </div>
            <p className="auth-access-hint">{copy.pointHint}</p>
            <div className="project-create-pair">
              {field(
                "province",
                copy.fieldProvince,
                <input id={createControlId("province")} className="auth-access-input" maxLength={100} aria-invalid={Boolean(form.formState.errors.province)} aria-describedby={describedBy("province")} {...form.register("province")} />,
              )}
              {field(
                "district",
                copy.fieldDistrict,
                <input id={createControlId("district")} className="auth-access-input" maxLength={100} aria-invalid={Boolean(form.formState.errors.district)} aria-describedby={describedBy("district")} {...form.register("district")} />,
              )}
            </div>
            <div className="project-create-pair">
              {field(
                "locality",
                copy.fieldLocality,
                <input id={createControlId("locality")} className="auth-access-input" maxLength={160} aria-invalid={Boolean(form.formState.errors.locality)} aria-describedby={describedBy("locality")} {...form.register("locality")} />,
              )}
              {field(
                "roadName",
                copy.fieldRoad,
                <input id={createControlId("roadName")} className="auth-access-input" maxLength={160} aria-invalid={Boolean(form.formState.errors.roadName)} aria-describedby={describedBy("roadName")} {...form.register("roadName")} />,
              )}
            </div>
            {field(
              "locationDescription",
              copy.fieldPlaceNote,
              <input id={createControlId("locationDescription")} className="auth-access-input" maxLength={500} aria-invalid={Boolean(form.formState.errors.locationDescription)} aria-describedby={describedBy("locationDescription")} {...form.register("locationDescription")} />,
            )}
            <fieldset className="project-create-pair">
              <legend className="auth-access-field-label">{copy.fieldLongitude} / {copy.fieldLatitude}</legend>
              {field(
                "longitude",
                copy.fieldLongitude,
                <input id={createControlId("longitude")} className="auth-access-input font-mono tabular-nums" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(form.formState.errors.longitude)} aria-describedby={describedBy("longitude")} {...form.register("longitude")} />,
              )}
              {field(
                "latitude",
                copy.fieldLatitude,
                <input id={createControlId("latitude")} className="auth-access-input font-mono tabular-nums" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(form.formState.errors.latitude)} aria-describedby={describedBy("latitude")} {...form.register("latitude")} />,
              )}
            </fieldset>
          </section>
        </div>

        <aside className="cac-card p-5 space-y-4 self-start lg:sticky lg:top-20" aria-labelledby="create-summary">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="font-mono text-xs font-bold text-[#ff5b00]">05</span>
            <h2 id="create-summary" className="text-base font-semibold text-slate-900">{copy.summaryTitle}</h2>
          </div>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">{copy.codePreview}</dt>
              <dd className="font-mono font-bold text-slate-900">{codePreview || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">{copy.sectionFunding}</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">{budgetPreview ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">{copy.sectionPlanning}</dt>
              <dd className="font-mono text-slate-700 tabular-nums">
                {watched.startDate || "—"} → {watched.plannedEndDate || "—"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-slate-600">{copy.agencyNote}</p>
          <p className="text-xs text-slate-500">{copy.laterNote}</p>
          {failureText ? (
            <p ref={bannerRef} className="auth-access-banner error" role="alert" tabIndex={-1}>
              {failureText}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button className="auth-access-button min-h-[44px] flex-1" type="submit" disabled={pending}>
              {pending ? copy.saving : copy.saveDraft}
            </button>
            <button
              className="auth-access-link min-h-[44px] px-3"
              type="button"
              onClick={() => {
                if (shouldConfirmDiscard(dirty, false) && !window.confirm(copy.discardConfirm)) return;
                clearDraft();
                onCancel();
              }}
            >
              {copy.cancel}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
