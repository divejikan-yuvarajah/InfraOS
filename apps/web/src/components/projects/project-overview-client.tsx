"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/projects/list-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProject, transitionProject } from "@/lib/projects/api";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { getProjectCopy, projectReadMessage } from "@/lib/projects/messages";
import { getReviewCopy } from "@/lib/projects/review-messages";
import { geometrySummary, lkrBudgetLabel, projectCoreQueryKey, safeListReturn, utcDateLabel, utcStampLabel } from "@/lib/projects/overview-format";
import { canLinkTimeline } from "@/lib/projects/timeline-view";
import type { ProjectDetail, ProjectLocation } from "@/lib/projects/types";

function useAuthPart(read: () => string, server: string): string {
  return useSyncExternalStore(subscribeAuth, read, () => server);
}

function placeLine(location: ProjectLocation | null | undefined, missing: string): string {
  if (!location) return missing;
  const parts = [location.roadName, location.locality, location.district, location.province].filter((part) => part && part.trim());
  return parts.length > 0 ? parts.join(", ") : missing;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="auth-access-field-label">{label}</span> {value}
    </p>
  );
}

function OverviewBody({
  project,
  copy,
  listQuery,
  pending,
  notice,
  reviewLabel,
  showTimeline,
  onTransition,
}: {
  project: ProjectDetail;
  copy: ReturnType<typeof getProjectCopy>;
  listQuery: string | null;
  pending: boolean;
  notice: string | null;
  reviewLabel: string;
  showTimeline: boolean;
  onTransition: (action: "SUBMIT" | "HOLD" | "RESUME" | "REOPEN", reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const needsReason = Boolean(project.availableActions?.includes("HOLD") || project.availableActions?.includes("RESUME"));
  const status = PROJECT_STATUSES.find((item) => item === project.status);
  const placeNote = project.location?.description?.trim() ? project.location.description : copy.notProvided;
  const description = project.description?.trim() ? project.description : copy.notProvided;
  return (
    <>
      <header className="project-overview-header auth-access-card">
        <div>
          <p className="auth-access-field-label">{copy.fieldCode}</p>
          <h2 id="project-overview-title">{project.title}</h2>
          <p>{project.projectCode}</p>
        </div>
        {status ? <ProjectStatusBadge status={status as ProjectStatus} /> : <p>{project.status}</p>}
        <p>{copy.fieldType}: {copy.types[project.projectType as keyof typeof copy.types] ?? project.projectType}</p>
        <p>{copy.columnAgency}: {project.agencyCode ?? project.agencyId}</p>
        <Fact label={copy.fieldManager} value={project.managerName?.trim() || copy.notProvided} />
      </header>
      <p role="note">{copy.overviewOnly}</p>
      <p><Link className="auth-access-button" href={`/projects/${project.id}/milestones`}>{copy.milestones}</Link></p>
      <p><Link className="auth-access-button" href={`/projects/${project.id}/progress`}>{copy.physicalProgress}</Link></p>
      {showTimeline ? <p><Link className="auth-access-button" href={`/projects/${project.id}/timeline`}>{copy.timeline}</Link></p> : null}
      <p role="note">{copy.readOnly}</p>
      {project.status === "DRAFT" ? <p role="status">{copy.draftOverview}</p> : null}
      {project.status === "SUBMITTED" || project.status === "UNDER_REVIEW" ? <p role="note">{copy.waitingReview}</p> : null}
      {project.status === "REJECTED" ? <p role="note">{copy.rejectedNote}</p> : null}
      {project.reviewDecision?.reason ? (
        <p role="status">{copy.decisionReason}: {project.reviewDecision.reason}</p>
      ) : null}
      <section className="auth-access-card project-overview-mark" aria-labelledby="project-lifecycle">
        <h3 id="project-lifecycle">{copy.lifecycleTitle}</h3>
        <p>{copy.lifecycleNote}</p>
        {project.submissionGaps && project.submissionGaps.length > 0 ? (
          <div role="status">
            <p>{copy.submissionNeeds}</p>
            <ul>
              {project.submissionGaps.map((gap) => (
                <li key={gap}>{gap === "dates" ? copy.gapDates : gap === "geometry" ? copy.gapGeometry : gap === "location" ? copy.gapLocation : gap === "budget" ? copy.gapBudget : copy.gapIdentity}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {notice ? <p role="alert">{notice}</p> : null}
        <div className="auth-access-locale-row">
          {project.availableActions?.includes("SUBMIT") && !(project.submissionGaps && project.submissionGaps.length > 0) ? (
            <button type="button" className="auth-access-button" disabled={pending} onClick={() => onTransition("SUBMIT")}>
              {pending ? copy.lifecycleWorking : copy.submitForReview}
            </button>
          ) : null}
          {needsReason ? (
            <div>
              <label className="auth-access-field-label" htmlFor="project-lifecycle-reason">{copy.reasonLabel}</label>
              <input
                id="project-lifecycle-reason"
                className="auth-access-input"
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          ) : null}
          {project.availableActions?.includes("HOLD") ? (
            <button type="button" className="auth-access-button" disabled={pending || reason.trim().length === 0} onClick={() => onTransition("HOLD", reason.trim())}>
              {copy.holdProject}
            </button>
          ) : null}
          {project.availableActions?.includes("RESUME") ? (
            <button type="button" className="auth-access-button" disabled={pending || reason.trim().length === 0} onClick={() => onTransition("RESUME", reason.trim())}>
              {copy.resumeProject}
            </button>
          ) : null}
          {project.availableActions?.includes("REOPEN") ? (
            <button type="button" className="auth-access-button" disabled={pending} onClick={() => onTransition("REOPEN")}>
              {pending ? copy.lifecycleWorking : copy.reopenDraft}
            </button>
          ) : null}
        </div>
      </section>
      {project.canEditDraft ? (
        <p>
          <Link className="auth-access-button" href={`/projects/${project.id}/edit${listQuery ? `?list=${encodeURIComponent(listQuery)}` : ""}`}>
            {copy.editDraft}
          </Link>
        </p>
      ) : null}
      {project.availableReviewActions && project.availableReviewActions.length > 0 ? (
        <p>
          <Link className="auth-access-button" href={`/projects/${project.id}/review`}>{reviewLabel}</Link>
        </p>
      ) : null}
      <div className="project-overview-grid">
        <section className="auth-access-card project-overview-mark" aria-labelledby="project-description">
          <h3 id="project-description">{copy.sectionDescription}</h3>
          <p className="project-overview-prose">{description}</p>
        </section>
        <section className="auth-access-card project-overview-mark" aria-labelledby="project-schedule">
          <h3 id="project-schedule">{copy.sectionSchedule}</h3>
          <Fact label={copy.fieldStart} value={utcDateLabel(project.startDate, copy.notProvided)} />
          <Fact label={copy.fieldEnd} value={utcDateLabel(project.plannedEndDate, copy.notProvided)} />
          <Fact label={copy.fieldActualEnd} value={utcDateLabel(project.actualEndDate, copy.notProvided)} />
          <Fact label={copy.fieldUpdated} value={utcStampLabel(project.updatedAt, copy.notProvided)} />
        </section>
        <section className="auth-access-card project-overview-mark" aria-labelledby="project-place">
          <h3 id="project-place">{copy.sectionPlace}</h3>
          <p className="project-overview-prose">{placeLine(project.location, copy.notProvided)}</p>
          <Fact label={copy.fieldPlaceNote} value={placeNote} />
          <Fact label={copy.fieldGeometry} value={geometrySummary(project.geometry, copy.notProvided)} />
        </section>
        <section className="auth-access-card project-overview-mark" aria-labelledby="project-progress">
          <h3 id="project-progress">{copy.sectionRecorded}</h3>
          <p>{typeof project.physicalProgress === "number" ? `${project.physicalProgress}%` : copy.notProvided}</p>
          <p>{copy.progressNote}</p>
        </section>
        {project.budget ? (
          <section className="auth-access-card project-overview-mark" aria-labelledby="project-budget">
            <h3 id="project-budget">{copy.sectionBudget}</h3>
            <p>{lkrBudgetLabel(project.budget.amountMinor, copy.notProvided)}</p>
          </section>
        ) : null}
      </div>
    </>
  );
}

export function ProjectOverviewClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const epoch = useAuthPart(() => String(getAuthEpoch()), "0");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "", "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "", "");
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getProjectCopy(locale);
  const listQuery = searchParams.get("list");
  const back = safeListReturn(listQuery);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const project = useQuery({
    queryKey: projectCoreQueryKey(epoch, userId, roleKey, id),
    queryFn: () => fetchProject(id),
    retry: false,
  });
  const transition = useMutation({
    mutationFn: (input: { action: "SUBMIT" | "HOLD" | "RESUME" | "REOPEN"; reason?: string }) => {
      const revision = project.data?.revision;
      if (typeof revision !== "number") throw new ApiError("missing revision", 409, { code: "CONFLICT" });
      return transitionProject(id, { action: input.action, revision, reason: input.reason });
    },
    retry: false,
    onSuccess: (result) => {
      if (result.epoch !== getAuthEpoch() || result.token !== getMemoryAccessToken()) {
        setNotice(copy.lifecycleConflict);
        return;
      }
      const session = getMemorySession();
      queryClient.setQueryData(projectCoreQueryKey(String(result.epoch), session?.user.id ?? "", session?.user.roleKey ?? "", id), result.project);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setNotice(copy.lifecycleSaved);
    },
    onError: (error) => {
      const kind = classifyEditError(error);
      setNotice(kind === "conflict" ? copy.lifecycleConflict : kind === "invalid" ? copy.lifecycleBlocked : projectReadMessage(error instanceof ApiError ? error.status : 503, copy));
    },
  });
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const error = project.error instanceof ApiError
    ? projectReadMessage(project.error.status, copy)
    : project.error
      ? (offline ? copy.offline : copy.unavailable)
      : null;

  return (
    <StaffWorkspaceShell title={copy.overview} description={project.data?.projectCode} wide>
      <p><Link href={back}>{copy.backToList}</Link></p>
      <section className="auth-access-card" aria-labelledby="project-locale">
        <p id="project-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Project language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code === "en" ? "English" : code === "si" ? "සිංහල" : "தமிழ்"}
            </button>
          ))}
        </div>
        <p role="note">{copy.nativeReview}</p>
      </section>
      {project.isLoading ? (
        <div className="project-overview-grid" role="status" aria-busy="true" aria-label={copy.loadingProject}>
          <div className="auth-access-card project-overview-skeleton" />
          <div className="auth-access-card project-overview-skeleton" />
        </div>
      ) : null}
      {error ? (
        <div className="auth-access-banner error" role="alert">
          <p>{error}</p>
          <button type="button" className="auth-access-button" onClick={() => void project.refetch()}>{copy.retry}</button>
        </div>
      ) : null}
      {project.data ? (
        <OverviewBody
          project={project.data}
          copy={copy}
          listQuery={listQuery}
          pending={transition.isPending}
          notice={notice}
          reviewLabel={getReviewCopy(locale).openReview}
          showTimeline={canLinkTimeline(roleKey)}
          onTransition={(action, reason) => {
            setNotice(null);
            transition.mutate({ action, reason });
          }}
        />
      ) : null}
    </StaffWorkspaceShell>
  );
}
