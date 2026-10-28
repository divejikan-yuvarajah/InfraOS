"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProject } from "@/lib/projects/api";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { actionsFor, milestoneFormSchema } from "@/lib/projects/milestone-form";
import { getMilestoneCopy } from "@/lib/projects/milestone-messages";
import { createMilestone, fetchMilestones, patchMilestone, transitionMilestone, type MilestoneRecord } from "@/lib/projects/milestones-api";
import { projectCoreQueryKey } from "@/lib/projects/overview-format";

const WRITE_ROLES = new Set(["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);
const ELIGIBLE = new Set(["APPROVED", "ACTIVE"]);

type FormValues = { title: string; description: string; plannedStart: string; plannedEnd: string };

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function milestoneKey(epoch: string, userId: string, roleKey: string, projectId: string) {
  return ["milestones", epoch, userId, roleKey, projectId] as const;
}

function noticeFor(kind: string, copy: ReturnType<typeof getMilestoneCopy>): string {
  if (kind === "conflict") return copy.conflict;
  if (kind === "invalid") return copy.invalid;
  if (kind === "denied") return copy.forbidden;
  if (kind === "notFound") return copy.notFound;
  if (kind === "unavailable") return copy.unavailable;
  if (kind === "offline") return copy.offline;
  return copy.blocked;
}

export function ProjectMilestonesClient({ id }: { id: string }) {
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getMilestoneCopy(locale);
  const queryClient = useQueryClient();
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no"));
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<MilestoneRecord | null>(null);
  const [pendingAction, setPendingAction] = useState<{ milestone: MilestoneRecord; action: ReturnType<typeof actionsFor>[number] } | null>(null);
  const listKey = milestoneKey(epoch, userId, roleKey, id);
  const projectQuery = useQuery({
    queryKey: projectCoreQueryKey(epoch, userId, roleKey, id),
    enabled: signedIn === "yes" && Boolean(userId),
    retry: false,
    queryFn: () => fetchProject(id),
  });
  const listQuery = useQuery({
    queryKey: listKey,
    enabled: signedIn === "yes" && Boolean(userId) && projectQuery.isSuccess,
    retry: false,
    queryFn: () => fetchMilestones(id),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: { title: "", description: "", plannedStart: "", plannedEnd: "" },
  });
  const editForm = useForm<FormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: { title: "", description: "", plannedStart: "", plannedEnd: "" },
  });
  useEffect(() => {
    if (!editing) return;
    editForm.reset({
      title: editing.title,
      description: editing.description ?? "",
      plannedStart: editing.plannedStart,
      plannedEnd: editing.plannedEnd,
    });
  }, [editing, editForm]);
  useEffect(() => {
    if (!pendingAction && !editing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPendingAction(null);
      setEditing(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingAction, editing]);
  const canWrite = WRITE_ROLES.has(roleKey) && ELIGIBLE.has(projectQuery.data?.status ?? "");

  function fail(error: unknown) {
    const kind = classifyEditError(error);
    if (kind === "unknown" && typeof navigator !== "undefined" && navigator.onLine === false) {
      setNotice(copy.offline);
      return;
    }
    setNotice(noticeFor(kind, copy));
  }

  const create = useMutation({
    mutationFn: (values: FormValues) => createMilestone(id, {
      title: values.title,
      description: values.description.trim() || undefined,
      plannedStart: values.plannedStart,
      plannedEnd: values.plannedEnd,
    }),
    onSuccess: async () => {
      setNotice(copy.saved);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: fail,
  });
  const edit = useMutation({
    mutationFn: (values: FormValues) => {
      if (!editing) throw new ApiError("missing", 400, { code: "VALIDATION_ERROR" });
      return patchMilestone(id, editing.id, {
        title: values.title,
        description: values.description,
        plannedStart: values.plannedStart,
        plannedEnd: values.plannedEnd,
        revision: editing.revision,
      });
    },
    onSuccess: async () => {
      setNotice(copy.updated);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: fail,
  });
  const move = useMutation({
    mutationFn: (input: { milestone: MilestoneRecord; action: string }) => transitionMilestone(id, input.milestone.id, {
      action: input.action,
      revision: input.milestone.revision,
    }),
    onSuccess: async () => {
      setNotice(copy.updated);
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: fail,
  });

  const projectError = projectQuery.error ? classifyEditError(projectQuery.error) : null;
  const listError = listQuery.error ? classifyEditError(listQuery.error) : null;

  return (
    <StaffWorkspaceShell title={copy.title} wide>
      <section className="auth-access-card" aria-labelledby="milestone-locale">
        <p id="milestone-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Milestone language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code === "en" ? "English" : code === "si" ? "සිංහල" : "தமிழ்"}
            </button>
          ))}
        </div>
        <p role="note">{copy.nativeReview}</p>
      </section>
      <p><Link href={`/projects/${id}/overview`}>{copy.back}</Link></p>
      {projectQuery.isLoading || (signedIn === "yes" && !userId) ? <p role="status">Loading</p> : null}
      {projectError ? <p role="alert">{noticeFor(projectError, copy)}</p> : null}
      {!projectQuery.isLoading && !projectQuery.isFetching && !projectQuery.data && !projectError && signedIn === "yes" && userId ? <p role="alert">{copy.notFound}</p> : null}
      {projectQuery.data ? (
        <header className="project-overview-header auth-access-card">
          <h2>{projectQuery.data.title}</h2>
          <p>{projectQuery.data.projectCode}</p>
          <p>{projectQuery.data.agencyCode ?? projectQuery.data.agencyId}</p>
          <p>{projectQuery.data.status}</p>
        </header>
      ) : null}
      {listQuery.data ? (
        <p>
          {copy.counts}: {copy.statuses.NOT_STARTED} {listQuery.data.counts.notStarted}, {copy.statuses.IN_PROGRESS} {listQuery.data.counts.inProgress}, {copy.statuses.DELAYED} {listQuery.data.counts.delayed}, {copy.statuses.BLOCKED} {listQuery.data.counts.blocked}, {copy.statuses.COMPLETED} {listQuery.data.counts.completed}
        </p>
      ) : null}
      {listError ? <p role="alert">{noticeFor(listError, copy)}</p> : null}
      {listQuery.isSuccess && listQuery.data.milestones.length === 0 ? <p role="status">{copy.empty}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!canWrite && projectQuery.data ? <p role="note">{ELIGIBLE.has(projectQuery.data.status) ? copy.readOnly : copy.notEligible}</p> : null}
      {canWrite ? (
        <form className="auth-access-card project-milestone-form" onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate>
          <h3>{copy.add}</h3>
          <label htmlFor="milestone-title">{copy.titleField}</label>
          <input id="milestone-title" {...form.register("title")} />
          <label htmlFor="milestone-description">{copy.descriptionField}</label>
          <textarea id="milestone-description" {...form.register("description")} />
          <label htmlFor="milestone-start">{copy.startField}</label>
          <input id="milestone-start" className="max-w-full min-w-0" type="date" {...form.register("plannedStart")} />
          <label htmlFor="milestone-end">{copy.endField}</label>
          <input id="milestone-end" className="max-w-full min-w-0" type="date" {...form.register("plannedEnd")} />
          {form.formState.errors.plannedEnd || form.formState.errors.title ? <p role="alert">{copy.invalid}</p> : null}
          <button className="auth-access-button" type="submit" disabled={create.isPending}>{create.isPending ? copy.saving : copy.save}</button>
          <p role="note">{copy.weightBlocked} {copy.noDelete}</p>
        </form>
      ) : null}
      <ol className="project-milestone-list" aria-label="Milestone timeline">
        {listQuery.data?.milestones.map((milestone) => (
          <li key={milestone.id} className="auth-access-card" data-status={milestone.status}>
            <h3>{milestone.title}</h3>
            <p><span className="project-status-badge" data-status={milestone.status}>{copy.statuses[milestone.status]}</span></p>
            <p>{milestone.plannedStart} – {milestone.plannedEnd}</p>
            <p>{copy.progress}: {milestone.progress}</p>
            {milestone.description ? <p>{milestone.description}</p> : null}
            <p>{milestone.actualStart ?? "—"} / {milestone.actualEnd ?? "—"}</p>
            {canWrite && milestone.status !== "COMPLETED" && milestone.status !== "CANCELLED" ? (
              <button type="button" className="auth-access-button" onClick={() => setEditing(milestone)}>{copy.edit}</button>
            ) : null}
            {canWrite ? actionsFor(milestone.status).map((action) => (
              <button
                key={action}
                type="button"
                className="auth-access-button"
                disabled={move.isPending}
                onClick={() => setPendingAction({ milestone, action })}
              >
                {copy.actions[action]}
              </button>
            )) : null}
          </li>
        ))}
      </ol>
      {pendingAction ? (
        <div className="auth-access-card" role="dialog" aria-modal="true" aria-labelledby="milestone-confirm-title">
          <h3 id="milestone-confirm-title">{copy.actions[pendingAction.action]} {pendingAction.milestone.title}</h3>
          <button type="button" className="auth-access-button" disabled={move.isPending} onClick={() => move.mutate(pendingAction, { onSuccess: () => setPendingAction(null) })}>
            {move.isPending ? copy.working : copy.actions[pendingAction.action]}
          </button>
          <button type="button" className="auth-access-button" onClick={() => setPendingAction(null)}>{copy.close}</button>
        </div>
      ) : null}
      {editing ? (
        <form className="auth-access-card project-milestone-form" onSubmit={editForm.handleSubmit((values) => edit.mutate(values))}>
          <h3>{copy.edit} {editing.title}</h3>
          <p>Revision {editing.revision}</p>
          <label htmlFor="edit-title">{copy.titleField}</label>
          <input id="edit-title" {...editForm.register("title")} />
          <label htmlFor="edit-description">{copy.descriptionField}</label>
          <textarea id="edit-description" {...editForm.register("description")} />
          <label htmlFor="edit-start">{copy.startField}</label>
          <input id="edit-start" className="max-w-full min-w-0" type="date" {...editForm.register("plannedStart")} />
          <label htmlFor="edit-end">{copy.endField}</label>
          <input id="edit-end" className="max-w-full min-w-0" type="date" {...editForm.register("plannedEnd")} />
          <button className="auth-access-button" type="submit" disabled={edit.isPending}>{copy.save}</button>
          <button className="auth-access-button" type="button" onClick={() => setEditing(null)}>{copy.close}</button>
        </form>
      ) : null}
    </StaffWorkspaceShell>
  );
}
