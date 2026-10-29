"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProject } from "@/lib/projects/api";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { fetchFinancialProgress } from "@/lib/projects/finance-api";
import { financeQueryKey, financialBarFill, showsMoney } from "@/lib/projects/finance-summary";
import { projectCoreQueryKey } from "@/lib/projects/overview-format";
import { fetchProgress, fetchProgressHistory, submitProgress } from "@/lib/projects/progress-api";
import { progressFormSchema, progressNoteReady } from "@/lib/projects/progress-form";
import { getProgressCopy } from "@/lib/projects/progress-messages";
import { formatLkrMinor } from "@/lib/data-table/query-state";

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
  const [locale, setLocale] = useState<AuthLocale>("en");
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
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <div role="group" aria-label={copy.language}>
        <button type="button" className="auth-access-button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>{copy.english}</button>
        <button type="button" className="auth-access-button" aria-pressed={locale === "si"} onClick={() => setLocale("si")}>{copy.sinhala}</button>
        <button type="button" className="auth-access-button" aria-pressed={locale === "ta"} onClick={() => setLocale("ta")}>{copy.tamil}</button>
      </div>
      <p role="note">{copy.nativeReview}</p>
      {roleKey === "CONTRACTOR" ? <p role="status">{copy.contractorBlocked}</p> : null}
      <p><Link className="auth-access-button" href={`/projects/${id}/overview`}>{copy.back}</Link></p>
      {loading ? <p role="status">Loading</p> : null}
      {projectError ? <p role="alert">{projectError}</p> : null}
      {!projectQuery.isLoading && !projectQuery.isFetching && !projectQuery.data && !projectError && signedIn === "yes" && userId ? <p role="alert">{copy.notFound}</p> : null}
      {projectQuery.data ? (
        <section className="auth-access-card" aria-labelledby="reported-progress-heading">
          <h2 id="reported-progress-heading">{copy.recorded}</h2>
          <p>{copy.officialStatus}: {projectQuery.data.status}</p>
          <p>{progressQuery.data ? `${progressQuery.data.physicalProgress}%` : "—"}</p>
          {progressQuery.data?.latest ? <p>{progressQuery.data.latest.note}</p> : <p>{copy.noneYet}</p>}
          {progressQuery.data?.latest ? <p>{copy.when}: {progressQuery.data.latest.reportedAt}</p> : null}
        </section>
      ) : null}
      {projectQuery.data ? <Comparison copy={copy} physical={progressQuery.data?.physicalProgress ?? null} finance={financeQuery.data} financeError={financeQuery.error} /> : null}
      {canSubmit ? (
        <form className="project-progress-form auth-access-card" onSubmit={form.handleSubmit((values) => submit.mutate(values))} noValidate>
          <label htmlFor="progress-percentage">{copy.percentage}</label>
          <input id="progress-percentage" type="number" inputMode="numeric" min={0} max={100} step={1} className="max-w-full min-w-0" {...form.register("percentage", { valueAsNumber: true })} />
          <label htmlFor="progress-note">{copy.note}</label>
          <textarea id="progress-note" className="max-w-full min-w-0" rows={4} {...form.register("note")} />
          <p>{copy.noteHint}</p>
          {notice ? <p role="alert">{notice}</p> : null}
          <button className="auth-access-button" type="submit" disabled={submit.isPending}>{submit.isPending ? copy.saving : copy.submit}</button>
        </form>
      ) : projectQuery.data ? <p role="note">{copy.activeOnly}</p> : null}
      {history && history.total > 0 ? (
        <section>
          <h2>{copy.history}</h2>
          <ol className="project-progress-list" aria-label={copy.history}>
            {history.reports.map((row) => (
              <li key={row.id}>
                <p>{row.reportedPercent}% ({copy.previous} {row.previousPercent}%)</p>
                <p>{row.note}</p>
                <p>{copy.when}: {row.reportedAt}</p>
              </li>
            ))}
          </ol>
          {page > 1 ? <button type="button" className="auth-access-button" onClick={() => setPage((value) => value - 1)}>{copy.newer}</button> : null}
          {history.total > page * history.limit ? <button type="button" className="auth-access-button" onClick={() => setPage((value) => value + 1)}>{copy.older}</button> : null}
        </section>
      ) : null}
    </StaffWorkspaceShell>
  );
}

function Meter({ label, value, fill, tone }: { label: string; value: string; fill: number; tone: "physical" | "financial" }) {
  return (
    <div>
      <p>{label}: {value}</p>
      <div className="progress-compare-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill)} aria-valuetext={value}>
        <div className={tone === "physical" ? "progress-compare-fill-physical" : "progress-compare-fill-financial"} style={{ width: `${fill}%` }} />
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
    <section className="auth-access-card" aria-labelledby="progress-compare-heading">
      <h2 id="progress-compare-heading">{copy.compareTitle}</h2>
      <p role="note">{copy.compareNote}</p>
      {physical == null ? null : <Meter label={copy.physicalBar} value={`${physical}%`} fill={financialBarFill(physical)} tone="physical" />}
      {denied ? <p role="status">{copy.financeRestricted}</p> : null}
      {!denied && summary?.availability === "unavailable" ? <p role="status">{copy.financeUnavailable}</p> : null}
      {!denied && !summary && financeError ? <p role="status">{copy.unavailable}</p> : null}
      {money ? (
        <>
          <Meter label={copy.financialBar} value={`${money.ratioPercent}%`} fill={financialBarFill(money.ratioPercent)} tone="financial" />
          {money.ratioPercent > 100 ? <p>{copy.barCapped}</p> : null}
          <p>{copy.budget}: {formatLkrMinor(money.budgetMinor)}</p>
          <p>{copy.paid}: {formatLkrMinor(money.paidMinor)}</p>
          <p>{copy.remaining}: {formatLkrMinor(money.remainingMinor)}</p>
          <p>{copy.overrun}: {formatLkrMinor(money.overrunMinor)}</p>
          <p>{copy.financeProvisional}</p>
          <p>{money.provenance}</p>
          {finance ? <p>{copy.calculatedAt}: {finance.calculatedAt}</p> : null}
        </>
      ) : null}
    </section>
  );
}
