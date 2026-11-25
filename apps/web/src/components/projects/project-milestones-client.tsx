"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, CheckCircle2Icon, ClockIcon, PlusIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import {
  BenchmarkStatusBadge,
  ChainageBar,
  CommandHeader,
  DataSourceBadge,
  MetricCard,
} from "@/components/common/civic-atlas-primitives";
import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fetchProject } from "@/lib/projects/api";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { actionsFor, milestoneFormSchema } from "@/lib/projects/milestone-form";
import { getMilestoneCopy } from "@/lib/projects/milestone-messages";
import {
  createMilestone,
  fetchMilestones,
  patchMilestone,
  transitionMilestone,
  type MilestoneRecord,
} from "@/lib/projects/milestones-api";
import { projectCoreQueryKey } from "@/lib/projects/overview-format";
import { ProjectRecordNav } from "./project-record-nav";

const WRITE_ROLES = new Set(["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"]);
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
  const [locale] = useWorkspaceLocale();
  const copy = getMilestoneCopy(locale);
  const queryClient = useQueryClient();
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no"));
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editing, setEditing] = useState<MilestoneRecord | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    milestone: MilestoneRecord;
    action: ReturnType<typeof actionsFor>[number];
  } | null>(null);

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
    mutationFn: (values: FormValues) =>
      createMilestone(id, {
        title: values.title,
        description: values.description.trim() || undefined,
        plannedStart: values.plannedStart,
        plannedEnd: values.plannedEnd,
      }),
    onSuccess: async () => {
      setNotice(copy.saved);
      form.reset();
      setShowCreateForm(false);
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
    mutationFn: (input: { milestone: MilestoneRecord; action: string }) =>
      transitionMilestone(id, input.milestone.id, {
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

  const counts = listQuery.data?.counts;
  const totalMilestones = counts
    ? counts.notStarted + counts.inProgress + counts.delayed + counts.blocked + counts.completed
    : 0;
  const completedPct =
    totalMilestones > 0 && counts ? Math.round((counts.completed / totalMilestones) * 100) : 0;

  return (
    <StaffWorkspaceShell
      title={copy.title}
      wide
      hidePageHeader
    ><div className="max-w-[1600px] mx-auto px-4 sm:px-gutter-desktop py-4 pb-10">
      <ProjectRecordNav id={id} locale={locale} />

      <div className="mt-4 space-y-6">
        {locale !== "en" ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {copy.nativeReview}
          </p>
        ) : null}

        {projectQuery.isLoading || (signedIn === "yes" && !userId) ? (
          <ContentSkeleton variant="kpi" label="Loading project milestones" />
        ) : null}

        {projectError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
          >
            {noticeFor(projectError, copy)}
          </div>
        ) : null}

        {!projectQuery.isLoading &&
        !projectQuery.isFetching &&
        !projectQuery.data &&
        !projectError &&
        signedIn === "yes" &&
        userId ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
          >
            {copy.notFound}
          </div>
        ) : null}

        {projectQuery.data ? (
          <CommandHeader
            variant="light"
            eyebrow={projectQuery.data.projectCode}
            title={projectQuery.data.title}
            scopeLabel={projectQuery.data.agencyCode ?? projectQuery.data.agencyId}
            sourceKind="recorded"
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>Project status:</span>
                <BenchmarkStatusBadge status={projectQuery.data.status} size="sm" />
              </span>
            }
            primaryAction={
              canWrite ? (
                <button
                  type="button"
                  onClick={() => setShowCreateForm((prev) => !prev)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#c43d00] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#802a00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b00]"
                >
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  <span>{copy.add}</span>
                </button>
              ) : null
            }
          >
            <ChainageBar
              verifiedPercent={completedPct}
              reportedPercent={
                typeof projectQuery.data.physicalProgress === "number"
                  ? projectQuery.data.physicalProgress
                  : null
              }
              label="Milestone station completion vs. reported physical progress"
              verifiedLabel="Milestones completed"
              reportedLabel="Reported physical"
            />
          </CommandHeader>
        ) : null}

        {counts ? (
          <section aria-label={copy.counts} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricCard
              label={copy.statuses.NOT_STARTED}
              value={counts.notStarted}
              context="Planned stations"
              sourceKind="recorded"
            />
            <MetricCard
              label={copy.statuses.IN_PROGRESS}
              value={counts.inProgress}
              context="Active works"
              tone="brand"
            />
            <MetricCard
              label={copy.statuses.DELAYED}
              value={counts.delayed}
              context="Schedule slippage"
              tone={counts.delayed > 0 ? "warning" : "neutral"}
            />
            <MetricCard
              label={copy.statuses.BLOCKED}
              value={counts.blocked}
              context="Requires clearance"
              tone={counts.blocked > 0 ? "critical" : "neutral"}
            />
            <MetricCard
              label={copy.statuses.COMPLETED}
              value={counts.completed}
              context={`Of ${totalMilestones} total`}
              tone="success"
            />
          </section>
        ) : null}

        {listError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
          >
            {noticeFor(listError, copy)}
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800"
          >
            {notice}
          </div>
        ) : null}

        {!canWrite && projectQuery.data ? (
          <p
            role="note"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600"
          >
            {ELIGIBLE.has(projectQuery.data.status) ? copy.readOnly : copy.notEligible}
          </p>
        ) : null}

        {canWrite && (showCreateForm || (listQuery.data?.milestones.length ?? 0) === 0) ? (
          <form
            className="cac-card p-6 space-y-4"
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            noValidate
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{copy.add}</h3>
                <p role="note" className="text-xs text-slate-500 mt-0.5">
                  {copy.weightBlocked} {copy.noDelete}
                </p>
              </div>
              {showCreateForm && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {copy.close}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="milestone-title"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {copy.titleField}
                </label>
                <input
                  id="milestone-title"
                  {...form.register("title")}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="milestone-description"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {copy.descriptionField}
                </label>
                <textarea
                  id="milestone-description"
                  rows={3}
                  {...form.register("description")}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
                />
              </div>

              <div>
                <label
                  htmlFor="milestone-start"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {copy.startField}
                </label>
                <input
                  id="milestone-start"
                  type="date"
                  {...form.register("plannedStart")}
                  className="h-10 w-full max-w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
                />
              </div>

              <div>
                <label
                  htmlFor="milestone-end"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {copy.endField}
                </label>
                <input
                  id="milestone-end"
                  type="date"
                  {...form.register("plannedEnd")}
                  className="h-10 w-full max-w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
                />
              </div>
            </div>

            {form.formState.errors.plannedEnd || form.formState.errors.title ? (
              <p role="alert" className="text-xs font-semibold text-[#8c1f28]">
                {copy.invalid}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                className="inline-flex min-h-10 items-center rounded-lg bg-[#c43d00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#802a00] disabled:opacity-50"
                type="submit"
                disabled={create.isPending}
              >
                {create.isPending ? copy.saving : copy.save}
              </button>
            </div>
          </form>
        ) : null}

        {listQuery.isSuccess && listQuery.data.milestones.length === 0 ? (
          <EmptyState variant="empty" title={copy.empty} />
        ) : null}

        {/* Alignment Timeline Station List */}
        <ol
          className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-3.5 before:w-0.5 before:bg-slate-200"
          aria-label="Milestone timeline"
        >
          {listQuery.data?.milestones.map((milestone, idx) => {
            const stationCode = `M-${String(idx + 1).padStart(2, "0")}`;
            const isCompleted = milestone.status === "COMPLETED";
            const isDelayed = milestone.status === "DELAYED";
            const isBlocked = milestone.status === "BLOCKED";
            const isActive = milestone.status === "IN_PROGRESS";

            return (
              <li key={milestone.id} className="relative pl-10" data-status={milestone.status}>
                <span
                  aria-hidden="true"
                  className={`absolute top-4 left-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-xs font-bold ${
                    isCompleted
                      ? "border-[#279541] bg-[#f0fdf4] text-[#166b30]"
                      : isBlocked
                        ? "border-[#8c1f28] bg-[#fef2f2] text-[#8c1f28]"
                        : isDelayed
                          ? "border-dashed border-[#d97706] bg-[#fffbeb] text-[#854d0e]"
                          : isActive
                            ? "border-[#ff5b00] bg-[#fff7ed] text-[#c43d00]"
                            : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {isCompleted
                    ? "✓"
                    : isBlocked
                      ? "■"
                      : isDelayed
                        ? "▲"
                        : isActive
                          ? "●"
                          : "○"}
                </span>

                <article className="cac-card p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700 tabular-nums">
                          {stationCode}
                        </span>
                        <BenchmarkStatusBadge
                          status={milestone.status}
                          label={copy.statuses[milestone.status]}
                          size="sm"
                        />
                        <DataSourceBadge kind="recorded" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {milestone.title}
                      </h3>
                      {milestone.description ? (
                        <p className="text-sm text-slate-600">{milestone.description}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canWrite &&
                      milestone.status !== "COMPLETED" &&
                      milestone.status !== "CANCELLED" ? (
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => setEditing(milestone)}
                        >
                          {copy.edit}
                        </button>
                      ) : null}
                      {canWrite
                        ? actionsFor(milestone.status).map((action) => (
                            <button
                              key={action}
                              type="button"
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                              disabled={move.isPending}
                              onClick={() => setPendingAction({ milestone, action })}
                            >
                              {copy.actions[action]}
                            </button>
                          ))
                        : null}
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Planned window</dt>
                        <dd className="font-mono font-semibold text-slate-800 tabular-nums">
                          {milestone.plannedStart} – {milestone.plannedEnd}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <ClockIcon className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">Actual start / end</dt>
                        <dd className="font-mono font-semibold text-slate-800 tabular-nums">
                          {milestone.actualStart ?? "—"} / {milestone.actualEnd ?? "—"}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <CheckCircle2Icon className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <div>
                        <dt className="text-slate-500">{copy.progress}</dt>
                        <dd className="font-mono font-semibold text-slate-800 tabular-nums">
                          {milestone.progress}%
                        </dd>
                      </div>
                    </div>
                  </dl>

                  <ChainageBar
                    verifiedPercent={isCompleted ? 100 : null}
                    reportedPercent={milestone.progress}
                    label={`${stationCode} progress`}
                    showRulerLabels={false}
                  />
                </article>
              </li>
            );
          })}
        </ol>

        {pendingAction ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-confirm-title"
          >
            <div className="cac-card w-full max-w-md p-6 space-y-4 shadow-xl">
              <h3 id="milestone-confirm-title" className="text-base font-bold text-slate-900">
                {copy.actions[pendingAction.action]} · {pendingAction.milestone.title}
              </h3>
              <p className="text-xs text-slate-600">
                Confirm transition for milestone station{" "}
                <strong className="text-slate-900">{pendingAction.milestone.title}</strong>.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setPendingAction(null)}
                >
                  {copy.close}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#c43d00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#802a00] disabled:opacity-50"
                  disabled={move.isPending}
                  onClick={() =>
                    move.mutate(pendingAction, { onSuccess: () => setPendingAction(null) })
                  }
                >
                  {move.isPending ? copy.working : copy.actions[pendingAction.action]}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editing ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-edit-title"
          >
            <form
              className="cac-card w-full max-w-lg p-6 space-y-4 shadow-xl"
              onSubmit={editForm.handleSubmit((values) => edit.mutate(values))}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 id="milestone-edit-title" className="text-base font-bold text-slate-900">
                    {copy.edit} · {editing.title}
                  </h3>
                  <p className="font-mono text-xs text-slate-500">Revision {editing.revision}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {copy.close}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="edit-title" className="block text-xs font-semibold text-slate-700 mb-1">
                    {copy.titleField}
                  </label>
                  <input
                    id="edit-title"
                    {...editForm.register("title")}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="edit-description" className="block text-xs font-semibold text-slate-700 mb-1">
                    {copy.descriptionField}
                  </label>
                  <textarea
                    id="edit-description"
                    rows={3}
                    {...editForm.register("description")}
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="edit-start" className="block text-xs font-semibold text-slate-700 mb-1">
                      {copy.startField}
                    </label>
                    <input
                      id="edit-start"
                      type="date"
                      {...editForm.register("plannedStart")}
                      className="h-10 w-full max-w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-end" className="block text-xs font-semibold text-slate-700 mb-1">
                      {copy.endField}
                    </label>
                    <input
                      id="edit-end"
                      type="date"
                      {...editForm.register("plannedEnd")}
                      className="h-10 w-full max-w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  {copy.close}
                </button>
                <button
                  className="rounded-lg bg-[#c43d00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#802a00] disabled:opacity-50"
                  type="submit"
                  disabled={edit.isPending}
                >
                  {copy.save}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div></StaffWorkspaceShell>
  );
}
