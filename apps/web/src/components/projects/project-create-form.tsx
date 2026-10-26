"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, type ReactNode } from "react";
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
}: {
  copy: ProjectCopy;
  failure: CreateFailure | null;
  pending: boolean;
  onSubmitBody: (body: ProjectCreateRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const pendingRef = useRef(false);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<ProjectCreateFormValues>({
    defaultValues: EMPTY,
    resolver: zodResolver(projectCreateFormSchema),
    mode: "onSubmit",
  });
  const codePreview = normalizeProjectCode(form.watch("projectCode"));
  const dirty = form.formState.isDirty;

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

  return (
    <form
      className="project-create-grid"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (pendingRef.current || pending) return;
        const built = buildProjectCreateBody(values);
        if (!built.ok) return;
        pendingRef.current = true;
        void onSubmitBody(built.body).catch(() => undefined).finally(() => {
          pendingRef.current = false;
        });
      }, (errors) => {
        const first = Object.keys(errors)[0] as CreateField | undefined;
        if (first) document.getElementById(createControlId(first))?.focus();
      })}
    >
      <div className="project-create-fields">
        <section className="auth-access-card" aria-labelledby="create-identity">
          <h2 id="create-identity" className="auth-access-section-title">{copy.sectionIdentity}</h2>
          <div className="project-create-fields">
            {field(
              "projectCode",
              copy.fieldCode,
              <input
                id={createControlId("projectCode")}
                className="auth-access-input"
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

        <section className="auth-access-card" aria-labelledby="create-planning">
          <h2 id="create-planning" className="auth-access-section-title">{copy.sectionPlanning}</h2>
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

        <section className="auth-access-card" aria-labelledby="create-funding">
          <h2 id="create-funding" className="auth-access-section-title">{copy.sectionFunding}</h2>
          {field(
            "amountLkr",
            copy.budgetLabel,
            <input
              id={createControlId("amountLkr")}
              className="auth-access-input"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={Boolean(form.formState.errors.amountLkr)}
              aria-describedby={describedBy("amountLkr", true)}
              {...form.register("amountLkr")}
            />,
            copy.budgetHint,
          )}
        </section>

        <section className="auth-access-card" aria-labelledby="create-place">
          <h2 id="create-place" className="auth-access-section-title">{copy.sectionPlace}</h2>
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
              <input id={createControlId("longitude")} className="auth-access-input" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(form.formState.errors.longitude)} aria-describedby={describedBy("longitude")} {...form.register("longitude")} />,
            )}
            {field(
              "latitude",
              copy.fieldLatitude,
              <input id={createControlId("latitude")} className="auth-access-input" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(form.formState.errors.latitude)} aria-describedby={describedBy("latitude")} {...form.register("latitude")} />,
            )}
          </fieldset>
        </section>
      </div>

      <aside className="auth-access-card" aria-labelledby="create-summary">
        <h2 id="create-summary" className="auth-access-section-title">{copy.summaryTitle}</h2>
        <p>{copy.agencyNote}</p>
        <p>{copy.laterNote}</p>
        <p>
          <span className="auth-access-field-label">{copy.codePreview}</span>
          <span>{codePreview || "—"}</span>
        </p>
        {failureText ? (
          <p ref={bannerRef} className="auth-access-banner error" role="alert" tabIndex={-1}>
            {failureText}
          </p>
        ) : null}
        <div className="auth-access-locale-row">
          <button className="auth-access-button" type="submit" disabled={pending}>
            {pending ? copy.saving : copy.saveDraft}
          </button>
          <button
            className="auth-access-link"
            type="button"
            onClick={() => {
              if (shouldConfirmDiscard(dirty, false) && !window.confirm(copy.discardConfirm)) return;
              onCancel();
            }}
          >
            {copy.cancel}
          </button>
        </div>
      </aside>
    </form>
  );
}
