"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
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
import { RequestVerificationButton } from "@/components/inspections/inspection-integrations";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { formatLkrMinor } from "@/lib/data-table/query-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fetchProject } from "@/lib/projects/api";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { fetchFinancialProgress } from "@/lib/projects/finance-api";
import { financeQueryKey, financialBarFill, showsMoney } from "@/lib/projects/finance-summary";
import { projectCoreQueryKey } from "@/lib/projects/overview-format";
import { fetchProgress, fetchProgressHistory, submitProgress } from "@/lib/projects/progress-api";
import { progressFormSchema, progressNoteReady } from "@/lib/projects/progress-form";
import { getProgressCopy } from "@/lib/projects/progress-messages";
import { ProjectRecordNav, RecordContext } from "./project-record-nav";

type FormValues = { percentage: number; note: string };

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

function progressKey(epoch: string, userId: string, roleKey: string, projectId: string) {
  return ["project-progress", epoch, userId, roleKey, projectId] as const;
}

function noticeFor(kind: string, copy: ReturnType<typeof getProgressCopy>): string {
  if (kind === "conflict") return copy.conflict;
  if (kind === "invalid") return copy.invalid;
  if (kind === "denied") return copy.forbidden;
  if (kind === "notFound") return copy.notFound;
  if (kind === "unavailable") return copy.unavailable;
  if (kind === "offline") return copy.offline;
  return copy.blocked;
}

export function ProjectProgressClient({ id }: { id: string }) {
  const [locale] = useWorkspaceLocale();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const copy = getProgressCopy(locale);
  const queryClient = useQueryClient();
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const signedIn = useAuthPart(() => (getMemoryAccessToken() ? "yes" : "no"));
  const listKey = progressKey(epoch, userId, roleKey, id);
  const projectQuery = useQuery({
    queryKey: projectCoreQueryKey(epoch, userId, roleKey, id),
    enabled: signedIn === "yes" && Boolean(userId),
    retry: false,
    queryFn: () => fetchProject(id),
  });
  const progressQuery = useQuery({
    queryKey: listKey,
    enabled: signedIn === "yes" && Boolean(userId) && projectQuery.isSuccess,
    retry: false,
    queryFn: () => fetchProgress(id),
  });
  const historyQuery = useQuery({
    queryKey: [...listKey, page],
    enabled: progressQuery.isSuccess,
    retry: false,
    queryFn: () => fetchProgressHistory(id, page),
  });
  const financeQuery = useQuery({
    queryKey: financeQueryKey(epoch, userId, roleKey, id),
    enabled: signedIn === "yes" && Boolean(userId) && projectQuery.isSuccess,
    retry: false,
    queryFn: () => fetchFinancialProgress(id),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(progressFormSchema),
    defaultValues: { percentage: 0, note: "" },
  });
  const currentPercent = progressQuery.data?.physicalProgress ?? 0;
  const canSubmit = roleKey === "PROJECT_MANAGER" && projectQuery.data?.status === "ACTIVE";
  const projectError = projectQuery.error ? noticeFor(classifyEditError(projectQuery.error), copy) : null;

  const submit = useMutation({
    mutationFn: (values: FormValues) => {
      const revision = progressQuery.data?.revision;
      if (typeof revision !== "number") throw new ApiError("missing revision", 409, { code: "CONFLICT" });
      if (!progressNoteReady(currentPercent, values.percentage, values.note)) {
        throw new ApiError("invalid note", 400, { code: "VALIDATION_ERROR" });
      }
      return submitProgress(id, { percentage: values.percentage, note: values.note.trim(), revision });
    },
    onSuccess: async () => {
      setNotice(copy.saved);
      form.reset({ percentage: 0, note: "" });
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: listKey });
      await queryClient.invalidateQueries({ queryKey: projectCoreQueryKey(epoch, userId, roleKey, id) });
    },
    onError: (error: unknown) => setNotice(noticeFor(classifyEditError(error), copy)),
  });

  const loading = signedIn === "yes" && (projectQuery.isLoading || (progressQuery.isLoading && projectQuery.isSuccess));
  const history = historyQuery.data;

  return (
    <StaffWorkspaceShell
      title={copy.title}
      description={copy.description}
      wide
      context={<RecordContext id={id} locale={locale} current={copy.title} />}
    >
      <ProjectRecordNav id={id} locale={locale} />

      <div className="mt-4 space-y-6">
        {roleKey === "CONTRACTOR" ? (
          <p
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900"
          >
            {copy.contractorBlocked}
          </p>
        ) : null}

        {loading ? <ContentSkeleton variant="kpi" label="Loading progress" /> : null}

        {projectError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
          >
            {projectError}
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
            title={copy.recorded}
            scopeLabel={projectQuery.data.agencyCode ?? projectQuery.data.agencyId}
            sourceKind="recorded"
            subtitle={
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{copy.officialStatus}:</span>
                  <BenchmarkStatusBadge status={projectQuery.data.status} size="sm" />
                </div>
                {progressQuery.data?.latest ? (
                  <p>
                    {progressQuery.data.latest.note} · {copy.when}: {progressQuery.data.latest.reportedAt}
                  </p>
                ) : (
                  <p>{copy.noneYet}</p>
                )}
              </div>
            }
            primaryAction={
              <RequestVerificationButton
                projectId={id}
                claimed={progressQuery.data?.latest ? progressQuery.data.physicalProgress : null}
              />
            }
          >
            <ChainageBar
              verifiedPercent={projectQuery.data.status === "COMPLETED" ? 100 : null}
              reportedPercent={progressQuery.data ? progressQuery.data.physicalProgress : null}
              label={`${copy.recorded}: ${progressQuery.data ? `${progressQuery.data.physicalProgress}%` : "—"}`}
              verifiedLabel="Verified completion"
              reportedLabel="Reported physical"
            />
          </CommandHeader>
        ) : null}

        {projectQuery.data ? (
          <Comparison
            copy={copy}
            physical={progressQuery.data?.physicalProgress ?? null}
            finance={financeQuery.data}
            financeError={financeQuery.error}
          />
        ) : null}

        {canSubmit ? (
          <form
            className="cac-card p-6 space-y-4"
            onSubmit={form.handleSubmit((values) => submit.mutate(values))}
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="progress-percentage"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {copy.percentage}
                </label>
                <input
                  id="progress-percentage"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  className="h-10 w-full max-w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
                  {...form.register("percentage", { valueAsNumber: true })}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="progress-note"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {copy.note}
                </label>
                <textarea
                  id="progress-note"
                  className="w-full max-w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
                  rows={3}
                  {...form.register("note")}
                />
                <p className="mt-1 text-xs text-slate-500">{copy.noteHint}</p>
              </div>
            </div>

            {notice ? (
              <p role="alert" className="text-xs font-semibold text-[#8c1f28]">
                {notice}
              </p>
            ) : null}

            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                className="inline-flex min-h-10 items-center rounded-lg bg-[#c43d00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#802a00] disabled:opacity-50"
                type="submit"
                disabled={submit.isPending}
              >
                {submit.isPending ? copy.saving : copy.submit}
              </button>
            </div>
          </form>
        ) : projectQuery.data ? (
          <p
            role="note"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600"
          >
            {copy.activeOnly}
          </p>
        ) : null}

        {history && history.total > 0 ? (
          <section className="cac-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">{copy.history}</h2>
              <DataSourceBadge kind="recorded" />
            </div>
            <ol
              className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-0.5 before:bg-slate-200"
              aria-label={copy.history}
            >
              {history.reports.map((row, idx) => (
                <li key={row.id} className="relative pl-9">
                  <span
                    aria-hidden="true"
                    className="absolute top-2.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#ff5b00] bg-[#fff7ed] font-mono text-[10px] font-bold text-[#c43d00]"
                  >
                    ●
                  </span>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        PRG-{String(idx + 1).padStart(2, "0")} · {row.reportedPercent}% ({copy.previous}{" "}
                        {row.previousPercent}%)
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {copy.when}: {row.reportedAt}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{row.note}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2 pt-2">
              {page > 1 ? (
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setPage((value) => value - 1)}
                >
                  {copy.newer}
                </button>
              ) : null}
              {history.total > page * history.limit ? (
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setPage((value) => value + 1)}
                >
                  {copy.older}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}

function Meter({
  label,
  value,
  fill,
  tone,
}: {
  label: string;
  value: string;
  fill: number;
  tone: "physical" | "financial";
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{value}</span>
      </div>
      <div
        className="relative h-4 w-full overflow-hidden rounded-md border border-slate-300 bg-slate-100"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={value}
      >
        <div
          className={`h-full transition-[width] duration-200 ${
            tone === "physical" ? "bg-[#ff5b00]" : "bg-[#279541]"
          }`}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
}

function Comparison({
  copy,
  physical,
  finance,
  financeError,
}: {
  copy: ReturnType<typeof getProgressCopy>;
  physical: number | null;
  finance: Awaited<ReturnType<typeof fetchFinancialProgress>> | undefined;
  financeError: unknown;
}) {
  const denied = financeError ? classifyEditError(financeError) === "denied" : false;
  const summary = finance?.summary;
  const money = showsMoney(summary) ? summary : null;
  return (
    <section className="cac-card p-5 space-y-4" aria-labelledby="progress-compare-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 id="progress-compare-heading" className="text-base font-semibold text-slate-900">
            {copy.compareTitle}
          </h2>
          <p role="note" className="text-xs text-slate-500">
            {copy.compareNote}
          </p>
        </div>
        <DataSourceBadge kind="recorded" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {physical == null ? null : (
          <Meter
            label={copy.physicalBar}
            value={`${physical}%`}
            fill={financialBarFill(physical)}
            tone="physical"
          />
        )}
        {money ? (
          <Meter
            label={copy.financialBar}
            value={`${money.ratioPercent}%`}
            fill={financialBarFill(money.ratioPercent)}
            tone="financial"
          />
        ) : null}
      </div>

      {denied ? (
        <p role="status" className="text-xs text-amber-800">
          {copy.financeRestricted}
        </p>
      ) : null}
      {!denied && summary?.availability === "unavailable" ? (
        <p role="status" className="text-xs text-slate-600">
          {copy.financeUnavailable}
        </p>
      ) : null}
      {!denied && !summary && financeError ? (
        <p role="status" className="text-xs text-slate-600">
          {copy.unavailable}
        </p>
      ) : null}

      {money ? (
        <div className="space-y-3 pt-2">
          {money.ratioPercent > 100 ? (
            <p className="text-xs font-semibold text-[#8c1f28]">{copy.barCapped}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label={copy.budget} value={formatLkrMinor(money.budgetMinor)} />
            <MetricCard label={copy.paid} value={formatLkrMinor(money.paidMinor)} tone="success" />
            <MetricCard label={copy.remaining} value={formatLkrMinor(money.remainingMinor)} />
            <MetricCard
              label={copy.overrun}
              value={formatLkrMinor(money.overrunMinor)}
              tone={money.overrunMinor > 0 ? "critical" : "neutral"}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>{copy.financeProvisional}</span>
            <span>{money.provenance}</span>
            {finance ? <span>{copy.calculatedAt}: {finance.calculatedAt}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
