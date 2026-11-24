"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import {
  AlignmentTimeline,
  CommandHeader,
  MetricCard,
  type AlignmentTimelineItem,
} from "@/components/common/civic-atlas-primitives";
import { WorkspaceContext } from "@/components/projects/project-record-nav";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { lkrBudgetLabel, projectCoreQueryKey, reviewDetailQueryKey, utcDateLabel } from "@/lib/projects/overview-format";
import { fetchReview, submitReview } from "@/lib/projects/api";
import { getReviewCopy, reviewFailureMessage } from "@/lib/projects/review-messages";
import { canHintProjectReview, type ProjectStatus } from "@/lib/projects/list-query";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function ProjectReviewClient({ id }: { id: string }) {
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const [locale] = useWorkspaceLocale();
  const copy = getReviewCopy(locale);
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pendingAction, setPendingAction] = useState<"BEGIN_REVIEW" | "APPROVE" | "REJECT" | "RETURN_FOR_CHANGES" | null>(null);
  const [phrase, setPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [phraseError, setPhraseError] = useState(false);
  const [reasonError, setReasonError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const review = useQuery({
    queryKey: reviewDetailQueryKey(epoch, userId, roleKey, id),
    queryFn: () => fetchReview(id),
    retry: false,
    enabled: canHintProjectReview(roleKey),
  });
  const decision = useMutation({
    mutationFn: (input: { action: "BEGIN_REVIEW" | "APPROVE" | "REJECT" | "RETURN_FOR_CHANGES"; reason?: string }) => {
      const revision = review.data?.project.revision;
      if (typeof revision !== "number") throw new ApiError("missing revision", 409, { code: "CONFLICT" });
      return submitReview(id, { action: input.action, revision, ...(input.reason ? { reason: input.reason } : {}) });
    },
    retry: false,
    onSuccess: (result) => {
      if (result.epoch !== getAuthEpoch() || result.token !== getMemoryAccessToken()) {
        setNotice(copy.conflict);
        return;
      }
      dialogRef.current?.close();
      setPendingAction(null);
      setPhrase("");
      setReason("");
      const session = getMemorySession();
      queryClient.setQueryData(projectCoreQueryKey(String(result.epoch), session?.user.id ?? "", session?.user.roleKey ?? "", id), result.project);
      void queryClient.invalidateQueries({ queryKey: ["review"] });
      void queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["project"] });
      setNotice(copy.saved);
      toast.success(copy.saved);
    },
    onError: (error) => {
      const msg = error instanceof ApiError ? reviewFailureMessage(error.status, copy) : copy.unavailable;
      setNotice(msg);
      toast.error(msg);
    },
  });

  const project = review.data?.project;
  const status = project ? (project.status as ProjectStatus) : undefined;
  const error = roleKey && !canHintProjectReview(roleKey)
    ? copy.forbidden
    : review.error instanceof ApiError
      ? reviewFailureMessage(review.error.status, copy)
      : review.error
        ? copy.unavailable
        : null;
  const geometry = project?.geometry?.type
    ? `${project.geometry.type}`
    : copy.notProvided;
  const place = [project?.location?.district, project?.location?.province, project?.location?.locality, project?.location?.roadName]
    .filter(Boolean)
    .join(", ");

  const needsReason = pendingAction === "REJECT" || pendingAction === "RETURN_FOR_CHANGES";

  function open(action: "BEGIN_REVIEW" | "APPROVE" | "REJECT" | "RETURN_FOR_CHANGES") {
    setPendingAction(action);
    setPhrase("");
    setReason("");
    setPhraseError(false);
    setReasonError(false);
    setNotice(null);
    dialogRef.current?.showModal();
  }

  function confirm() {
    if (!pendingAction || !project) return;
    const typed = reason.replace(/[\r\n]+/g, " ").replace(/[ \t]{2,}/g, " ").trim();
    const reasonOk = !needsReason || (typed.length >= 1 && typed.length <= 500 && !typed.includes("$"));
    if (phrase.trim() !== project.projectCode || !reasonOk) {
      setPhraseError(phrase.trim() !== project.projectCode);
      setReasonError(!reasonOk);
      return;
    }
    decision.mutate({ action: pendingAction, ...(needsReason ? { reason: typed } : {}) });
  }

  const confirmTitle = pendingAction === "APPROVE"
    ? copy.confirmApprove
    : pendingAction === "REJECT"
      ? copy.confirmReject
      : pendingAction === "RETURN_FOR_CHANGES"
        ? copy.confirmReturn
        : copy.confirmBegin;

  const decisionItems: AlignmentTimelineItem[] = (review.data?.decisions ?? []).map((item, idx) => {
    const actionUpper = item.action.toUpperCase();
    const state =
      actionUpper === "APPROVE"
        ? "verified"
        : actionUpper === "REJECT"
          ? "blocked"
          : actionUpper === "RETURN_FOR_CHANGES"
            ? "delayed"
            : "recorded";
    return {
      id: `${item.action}-${item.at}-${item.requestId ?? idx}`,
      stationCode: `D-${String(idx + 1).padStart(2, "0")}`,
      title: item.status.replaceAll("_", " "),
      subtitle: item.reason ? `${copy.reasonLabel}: ${item.reason}` : undefined,
      state,
      statusLabel: item.action.replaceAll("_", " "),
      actualWindow: utcDateLabel(item.at, item.at),
    };
  });

  return (
    <StaffWorkspaceShell title={copy.reviewTitle} description={project?.projectCode} wide context={<WorkspaceContext locale={locale} current={copy.reviewTitle} projects />}>
      {locale !== "en" ? <p className="spp-small mb-3">{copy.nativeReview}</p> : null}
      {review.isLoading ? <p role="status" className="cac-card p-4 text-sm text-slate-600">Loading review record…</p> : null}
      {error ? <div className="auth-access-banner error mb-4" role="alert"><p>{error}</p></div> : null}
      {notice ? <p role="status" className="cac-card border-l-4 border-l-[#ff5b00] p-3 mb-4 text-sm font-medium text-slate-800">{notice}</p> : null}
      {project && status ? (
        <div className="space-y-5">
          <CommandHeader
            eyebrow={`${project.agencyCode ?? project.agencyId} · ${project.projectCode}`}
            title={project.title}
            subtitle={
              <span className="inline-flex flex-wrap items-center gap-2">
                <ShieldCheck aria-hidden="true" size={15} />
                <span>{project.managerName ?? copy.notProvided}</span>
                <ProjectStatusBadge status={status} />
              </span>
            }
            sourceKind="live"
            secondaryActions={
              <Link href="/projects/reviews" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/25 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10">
                {copy.backToQueue}
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={copy.sectionSchedule}
              value={<span className="text-sm">{utcDateLabel(project.startDate, copy.notProvided)} – {utcDateLabel(project.plannedEndDate, copy.notProvided)}</span>}
              sourceKind="live"
            />
            <MetricCard
              label={copy.sectionLocation}
              value={<span className="text-sm">{place || copy.notProvided}</span>}
              sourceKind="live"
            />
            <MetricCard
              label={copy.sectionGeometry}
              value={<span className="text-base">{geometry}</span>}
              sourceKind="live"
            />
            {project.budget ? (
              <MetricCard
                label={copy.sectionBudget}
                value={<span className="text-base">{lkrBudgetLabel(project.budget.amountMinor, copy.notProvided)}</span>}
                sourceKind="live"
                tone="brand"
              />
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="cac-card p-5 space-y-2" aria-labelledby="review-submission">
              <h3 id="review-submission" className="text-sm font-bold text-slate-900">{copy.submissionFound}</h3>
              {review.data?.submission.found ? (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Submitted</dt>
                    <dd className="font-mono font-semibold text-slate-800">{utcDateLabel(review.data.submission.at, copy.notProvided)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{copy.submissionActor}</dt>
                    <dd className="font-mono font-semibold text-slate-800 truncate">{review.data.submission.userId}</dd>
                  </div>
                </dl>
              ) : <p role="status" className="text-xs text-slate-500">{copy.submissionMissing}</p>}
            </section>
            <section className="cac-card p-5 space-y-3" aria-labelledby="review-actions">
              <h3 id="review-actions" className="text-sm font-bold text-slate-900">{copy.reviewTitle}</h3>
              {project.availableReviewActions?.length ? null : <p role="status" className="text-xs text-slate-500">{copy.noActions}</p>}
              <div className="flex flex-wrap gap-2">
                {project.availableReviewActions?.includes("BEGIN_REVIEW") ? (
                  <button type="button" className="auth-access-button min-h-[44px]" data-decision="begin" onClick={() => open("BEGIN_REVIEW")}>{copy.beginReview}</button>
                ) : null}
                {project.availableReviewActions?.includes("APPROVE") ? (
                  <button type="button" className="auth-access-button min-h-[44px]" data-decision="approve" onClick={() => open("APPROVE")}>{copy.approve}</button>
                ) : null}
                {project.availableReviewActions?.includes("RETURN_FOR_CHANGES") ? (
                  <button type="button" className="auth-access-link min-h-[44px] border border-amber-300 bg-amber-50 px-3 text-amber-900" data-decision="return" onClick={() => open("RETURN_FOR_CHANGES")}>{copy.returnForChanges}</button>
                ) : null}
                {project.availableReviewActions?.includes("REJECT") ? (
                  <button type="button" className="auth-access-link min-h-[44px] border border-red-300 bg-red-50 px-3 text-red-900" data-decision="reject" onClick={() => open("REJECT")}>{copy.reject}</button>
                ) : null}
              </div>
            </section>
          </div>
          <section className="cac-card p-5 space-y-3" aria-labelledby="review-history">
            <h3 id="review-history" className="text-sm font-bold text-slate-900">{copy.decisionHistory}</h3>
            {decisionItems.length > 0 ? (
              <AlignmentTimeline items={decisionItems} ariaLabel={copy.decisionHistory} />
            ) : <p role="status" className="text-xs text-slate-500">{copy.noDecision}</p>}
          </section>
          <dialog ref={dialogRef} className="cac-card mc-dialog p-5 space-y-4" aria-labelledby="review-confirm-title" onClose={() => { if (!decision.isPending) setPendingAction(null); }}>
            <h3 id="review-confirm-title" className="text-base font-bold text-slate-900">{confirmTitle}</h3>
            {needsReason ? (
              <div>
                <label className="auth-access-field-label" htmlFor="review-decision-reason">{copy.reasonLabel}</label>
                <textarea
                  id="review-decision-reason"
                  className="auth-access-input"
                  value={reason}
                  maxLength={500}
                  rows={4}
                  aria-invalid={reasonError}
                  aria-describedby={reasonError ? "review-reason-error" : "review-reason-hint"}
                  onChange={(event) => { setReason(event.target.value); setReasonError(false); }}
                />
                <p id="review-reason-hint" className="auth-access-hint">{copy.reasonHint}</p>
                {reasonError ? <p id="review-reason-error" className="project-create-error" role="alert">{copy.invalidReason}</p> : null}
              </div>
            ) : null}
            <div>
              <label className="auth-access-field-label" htmlFor="review-confirm-phrase">{copy.confirmPhrase}</label>
              <input
                id="review-confirm-phrase"
                className="auth-access-input font-mono"
                value={phrase}
                aria-invalid={phraseError}
                aria-describedby={phraseError ? "review-confirm-error" : undefined}
                onChange={(event) => { setPhrase(event.target.value); setPhraseError(false); }}
              />
              {phraseError ? <p id="review-confirm-error" className="project-create-error" role="alert">{copy.confirmPhrase}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="auth-access-button min-h-[44px]" disabled={decision.isPending} onClick={confirm}>
                {decision.isPending ? copy.working : copy.confirmAction}
              </button>
              <button type="button" className="auth-access-link min-h-[44px] px-3" disabled={decision.isPending} onClick={() => dialogRef.current?.close()}>{copy.cancel}</button>
            </div>
          </dialog>
        </div>
      ) : null}
    </StaffWorkspaceShell>
  );
}
