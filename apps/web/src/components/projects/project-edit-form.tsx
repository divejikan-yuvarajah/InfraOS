"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { shouldConfirmDiscard } from "@/lib/projects/create-outcome";
import { projectEditFormSchema, type ProjectEditFormValues } from "@/lib/projects/edit-schema";
import type { EditFailure } from "@/lib/projects/edit-outcome";
import {
  buildProjectPatchBody,
  editBaselineFromProject,
  editFormValuesFromProject,
  editControlId,
  editErrorId,
  preservedGeometryLabel,
  readOnlyContextLine,
  type EditField,
  type EditIssue,
  type ProjectPatchRequest,
} from "@/lib/projects/edit-transform";
import type { ProjectCopy } from "@/lib/projects/messages";
import type { ProjectDetail } from "@/lib/projects/types";

function issueText(copy: ProjectCopy, issue: string | undefined): string | undefined {
  if (!issue) return undefined;
  const known = copy.errors[issue as EditIssue];
  return known ?? copy.errors.format;
}

export function ProjectEditForm({
  copy,
  project,
  failure,
  pending,
  saved,
  onSubmitBody,
  onCancel,
  onReloadLatest,
}: {
  copy: ProjectCopy;
  project: ProjectDetail;
  failure: EditFailure | null;
  pending: boolean;
  saved: boolean;
  onSubmitBody: (body: ProjectPatchRequest) => Promise<void>;
  onCancel: () => void;
  onReloadLatest: () => void;
}) {
  const bannerRef = useRef<HTMLParagraphElement>(null);
  const baseline = useMemo(() => editBaselineFromProject(project), [project]);
  const schema = useMemo(() => projectEditFormSchema(baseline), [baseline]);
  const form = useForm<ProjectEditFormValues>({
    defaultValues: editFormValuesFromProject(project),
    resolver: zodResolver(schema),
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(editFormValuesFromProject(project));
  }, [form, project]);

  const dirty = form.formState.isDirty;

  useEffect(() => {
    if (failure) bannerRef.current?.focus();
  }, [failure]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!shouldConfirmDiscard(dirty, saved)) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty, saved]);

  const failureText = failure ? copy.errors[failure] ?? copy.errors.unknown : null;
  const showPointEditor = baseline.geometryKind !== "complex";

  const field = (name: EditField, label: string, control: ReactNode, hint?: string) => {
    const message = issueText(copy, form.formState.errors[name]?.message);
    const hintId = hint ? `${editControlId(name)}-hint` : undefined;
    return (
      <div>
        <label className="auth-access-field-label" htmlFor={editControlId(name)}>
          {label}
        </label>
        {control}
        {hint ? (
          <p className="auth-access-hint" id={hintId}>
            {hint}
          </p>
        ) : null}
        {message ? (
          <p className="project-create-error" id={editErrorId(name)} role="alert">
            {message}
          </p>
        ) : null}
      </div>
    );
  };

  const describedBy = (name: EditField, hint?: boolean) => {
    const parts = [];
    if (hint) parts.push(`${editControlId(name)}-hint`);
    if (form.formState.errors[name]) parts.push(editErrorId(name));
    return parts.length > 0 ? parts.join(" ") : undefined;
  };

  return (
    <form
      className="project-create-grid"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (pending) return;
        const built = buildProjectPatchBody(values, baseline);
        if (!built.ok) return;
        void onSubmitBody(built.body).catch(() => undefined);
      }, (fieldErrors) => {
        const first = Object.keys(fieldErrors)[0] as EditField | undefined;
        if (first) {
          window.requestAnimationFrame(() => {
            document.getElementById(editControlId(first))?.focus();
          });
        }
      })}
    >
      <div className="project-create-fields">
        <section className="auth-access-card" aria-labelledby="edit-context">
          <h2 id="edit-context" className="auth-access-section-title">{copy.sectionIdentity}</h2>
          <p>{readOnlyContextLine(project, copy)}</p>
          <p className="auth-access-hint">{copy.editContextNote}</p>
          {field(
            "title",
            copy.fieldTitle,
            <input
              id={editControlId("title")}
              className="auth-access-input"
              autoComplete="off"
              maxLength={200}
              aria-invalid={Boolean(form.formState.errors.title)}
              aria-describedby={describedBy("title")}
              {...form.register("title")}
            />,
          )}
          {field(
            "description",
            copy.fieldDescription,
            <textarea
              id={editControlId("description")}
              className="auth-access-input"
              rows={4}
              maxLength={5000}
              aria-invalid={Boolean(form.formState.errors.description)}
              aria-describedby={describedBy("description")}
              {...form.register("description")}
            />,
          )}
        </section>

        <section className="auth-access-card" aria-labelledby="edit-planning">
          <h2 id="edit-planning" className="auth-access-section-title">{copy.sectionPlanning}</h2>
          <div className="project-create-pair">
            {field(
              "startDate",
              copy.fieldStart,
              <input
                id={editControlId("startDate")}
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
                id={editControlId("plannedEndDate")}
                className="auth-access-input"
                type="date"
                aria-invalid={Boolean(form.formState.errors.plannedEndDate)}
                aria-describedby={describedBy("plannedEndDate")}
                {...form.register("plannedEndDate")}
              />,
            )}
          </div>
        </section>

        <section className="auth-access-card" aria-labelledby="edit-place">
          <h2 id="edit-place" className="auth-access-section-title">{copy.sectionPlace}</h2>
          {baseline.geometryKind === "complex" ? (
            <p role="note">{copy.geometryPreserved}</p>
          ) : (
            <p className="auth-access-hint">{copy.pointHint}</p>
          )}
          {baseline.geometryKind === "complex" ? (
            <p>
              <span className="auth-access-field-label">{copy.fieldGeometry}</span>{" "}
              {preservedGeometryLabel(baseline.geometry, baseline.geometryKind, copy.notProvided)}
            </p>
          ) : null}
          <div className="project-create-pair">
            {field(
              "province",
              copy.fieldProvince,
              <input id={editControlId("province")} className="auth-access-input" maxLength={100} aria-invalid={Boolean(form.formState.errors.province)} aria-describedby={describedBy("province")} {...form.register("province")} />,
            )}
            {field(
              "district",
              copy.fieldDistrict,
              <input id={editControlId("district")} className="auth-access-input" maxLength={100} aria-invalid={Boolean(form.formState.errors.district)} aria-describedby={describedBy("district")} {...form.register("district")} />,
            )}
          </div>
          <div className="project-create-pair">
            {field(
              "locality",
              copy.fieldLocality,
              <input id={editControlId("locality")} className="auth-access-input" maxLength={160} aria-invalid={Boolean(form.formState.errors.locality)} aria-describedby={describedBy("locality")} {...form.register("locality")} />,
            )}
            {field(
              "roadName",
              copy.fieldRoad,
              <input id={editControlId("roadName")} className="auth-access-input" maxLength={160} aria-invalid={Boolean(form.formState.errors.roadName)} aria-describedby={describedBy("roadName")} {...form.register("roadName")} />,
            )}
          </div>
          {field(
            "locationDescription",
            copy.fieldPlaceNote,
            <input id={editControlId("locationDescription")} className="auth-access-input" maxLength={500} aria-invalid={Boolean(form.formState.errors.locationDescription)} aria-describedby={describedBy("locationDescription")} {...form.register("locationDescription")} />,
          )}
          {showPointEditor ? (
            <fieldset className="project-create-pair">
              <legend className="auth-access-field-label">{copy.fieldLongitude} / {copy.fieldLatitude}</legend>
              {field(
                "longitude",
                copy.fieldLongitude,
                <input id={editControlId("longitude")} className="auth-access-input" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(form.formState.errors.longitude)} aria-describedby={describedBy("longitude")} {...form.register("longitude")} />,
              )}
              {field(
                "latitude",
                copy.fieldLatitude,
                <input id={editControlId("latitude")} className="auth-access-input" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(form.formState.errors.latitude)} aria-describedby={describedBy("latitude")} {...form.register("latitude")} />,
              )}
            </fieldset>
          ) : null}
          {baseline.geometryKind !== "none" ? (
            <label className="auth-access-field-label">
              <input type="checkbox" {...form.register("removeGeometry")} /> {copy.removeGeometryLabel}
            </label>
          ) : null}
        </section>
      </div>

      <aside className="auth-access-card" aria-labelledby="edit-actions">
        <h2 id="edit-actions" className="auth-access-section-title">{copy.summaryTitle}</h2>
        {saved ? (
          <p className="auth-access-status" role="status">
            {copy.savedChanges}
          </p>
        ) : null}
        {failureText ? (
          <p ref={bannerRef} className="auth-access-banner error" role="alert" tabIndex={-1}>
            {failureText}
          </p>
        ) : null}
        {failure === "conflict" ? (
          <button type="button" className="auth-access-button" onClick={onReloadLatest}>
            {copy.retry}
          </button>
        ) : null}
        <div className="auth-access-locale-row">
          <button className="auth-access-button" type="submit" disabled={pending}>
            {pending ? copy.savingChanges : copy.saveChanges}
          </button>
          <button
            className="auth-access-link"
            type="button"
            onClick={() => {
              if (shouldConfirmDiscard(dirty, saved) && !window.confirm(copy.editDiscardConfirm)) return;
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
