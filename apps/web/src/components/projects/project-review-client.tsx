"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { lkrBudgetLabel, projectCoreQueryKey, reviewDetailQueryKey, utcDateLabel } from "@/lib/projects/overview-format";
import { fetchReview, submitReview } from "@/lib/projects/api";
import { getReviewCopy, reviewFailureMessage } from "@/lib/projects/review-messages";
import type { ProjectStatus } from "@/lib/projects/list-query";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function ProjectReviewClient({ id }: { id: string }) {
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const [locale, setLocale] = useState<AuthLocale>("en");
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
    enabled: roleKey === "GOV_ADMIN",
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
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? reviewFailureMessage(error.status, copy) : copy.unavailable);
    },
  });

  const project = review.data?.project;
  const status = project ? (project.status as ProjectStatus) : undefined;
  const error = roleKey && roleKey !== "GOV_ADMIN"
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

  return (
    <StaffWorkspaceShell title={copy.reviewTitle} description={project?.projectCode} wide>
      <p><Link href="/projects/reviews">{copy.backToQueue}</Link></p>
      <section className="auth-access-card" aria-labelledby="review-detail-locale">
        <p id="review-detail-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Review language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code === "en" ? "English" : code === "si" ? "සිංහල" : "தமிழ்"}
            </button>
          ))}
        </div>
        <p role="note">{copy.nativeReview}</p>
      </section>
      {review.isLoading ? <p role="status">Loading</p> : null}
      {error ? <div className="auth-access-banner error" role="alert"><p>{error}</p></div> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {project && status ? (
        <>
          <header className="auth-access-card">
            <p className="auth-access-kicker"><ShieldCheck aria-hidden="true" size={16} /> {project.agencyCode ?? project.agencyId}</p>
            <h2>{project.title}</h2>
            <ProjectStatusBadge status={status} />
            <p>{project.managerName ?? copy.notProvided}</p>
          </header>
          <div className="project-overview-grid">
            <section className="auth-access-card" aria-labelledby="review-schedule">
              <h3 id="review-schedule">{copy.sectionSchedule}</h3>
              <p>{utcDateLabel(project.startDate, copy.notProvided)} – {utcDateLabel(project.plannedEndDate, copy.notProvided)}</p>
            </section>
            <section className="auth-access-card" aria-labelledby="review-location">
              <h3 id="review-location">{copy.sectionLocation}</h3>
              <p>{place || copy.notProvided}</p>
            </section>
            <section className="auth-access-card" aria-labelledby="review-geometry">
              <h3 id="review-geometry">{copy.sectionGeometry}</h3>
              <p>{geometry}</p>
            </section>
            {project.budget ? (
              <section className="auth-access-card" aria-labelledby="review-budget">
                <h3 id="review-budget">{copy.sectionBudget}</h3>
                <p>{lkrBudgetLabel(project.budget.amountMinor, copy.notProvided)}</p>
              </section>
            ) : null}
          </div>
          <section className="auth-access-card" aria-labelledby="review-submission">
            <h3 id="review-submission">{copy.submissionFound}</h3>
            {review.data?.submission.found ? (
              <>
                <p>{utcDateLabel(review.data.submission.at, copy.notProvided)}</p>
                <p>{copy.submissionActor}: {review.data.submission.userId}</p>
              </>
            ) : <p role="status">{copy.submissionMissing}</p>}
          </section>
          <section className="auth-access-card" aria-labelledby="review-actions">
            <h3 id="review-actions">{copy.reviewTitle}</h3>
            <div className="auth-access-locale-row">
              {project.availableReviewActions?.includes("BEGIN_REVIEW") ? (
                <button type="button" className="auth-access-button" onClick={() => open("BEGIN_REVIEW")}>{copy.beginReview}</button>
              ) : null}
              {project.availableReviewActions?.includes("APPROVE") ? (
                <button type="button" className="auth-access-button" onClick={() => open("APPROVE")}>{copy.approve}</button>
              ) : null}
              {project.availableReviewActions?.includes("REJECT") ? (
                <button type="button" className="auth-access-button" onClick={() => open("REJECT")}>{copy.reject}</button>
              ) : null}
              {project.availableReviewActions?.includes("RETURN_FOR_CHANGES") ? (
                <button type="button" className="auth-access-button" onClick={() => open("RETURN_FOR_CHANGES")}>{copy.returnForChanges}</button>
              ) : null}
            </div>
          </section>
          <section className="auth-access-card" aria-labelledby="review-history">
            <h3 id="review-history">{copy.decisionHistory}</h3>
            {review.data?.decisions.length ? (
              <ul>
                {review.data.decisions.map((item) => (
                  <li key={`${item.action}-${item.at}-${item.requestId ?? "none"}`}>
                    <p>{item.status} · {item.at}</p>
                    {item.reason ? <p>{copy.reasonLabel}: {item.reason}</p> : null}
                  </li>
                ))}
              </ul>
            ) : <p role="status">{copy.noDecision}</p>}
          </section>
          <dialog ref={dialogRef} className="auth-access-card" aria-labelledby="review-confirm-title" onClose={() => { if (!decision.isPending) setPendingAction(null); }}>
            <h3 id="review-confirm-title">{confirmTitle}</h3>
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
                <p id="review-reason-hint">{copy.reasonHint}</p>
                {reasonError ? <p id="review-reason-error" role="alert">{copy.invalidReason}</p> : null}
              </div>
            ) : null}
            <div>
              <label className="auth-access-field-label" htmlFor="review-confirm-phrase">{copy.confirmPhrase}</label>
              <input
                id="review-confirm-phrase"
                className="auth-access-input"
                value={phrase}
                aria-invalid={phraseError}
                aria-describedby={phraseError ? "review-confirm-error" : undefined}
                onChange={(event) => { setPhrase(event.target.value); setPhraseError(false); }}
              />
              {phraseError ? <p id="review-confirm-error" role="alert">{copy.confirmPhrase}</p> : null}
            </div>
            <div className="auth-access-locale-row">
              <button type="button" className="auth-access-button" disabled={decision.isPending} onClick={confirm}>
                {decision.isPending ? copy.working : copy.confirmAction}
              </button>
              <button type="button" className="auth-access-button" disabled={decision.isPending} onClick={() => dialogRef.current?.close()}>{copy.cancel}</button>
            </div>
          </dialog>
        </>
      ) : null}
    </StaffWorkspaceShell>
  );
}
