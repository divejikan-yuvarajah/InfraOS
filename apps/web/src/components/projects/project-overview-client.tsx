"use client";

import { ProjectContractorsCard } from "@/components/contractors/project-contractors-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar, DualProgress, FactsList, HonestyChip, LifecycleRail, StatusChip } from "@/components/site-plan/site-plan";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fetchProject, transitionProject } from "@/lib/projects/api";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import { dashboardStatusLabel } from "@/lib/projects/dashboard-view";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { fetchFinancialProgress } from "@/lib/projects/finance-api";
import { financeQueryKey, financialForBar } from "@/lib/projects/finance-summary";
import { getProjectCopy, projectReadMessage } from "@/lib/projects/messages";
import { geometrySummary, lkrBudgetLabel, projectCoreQueryKey, safeListReturn, utcDateLabel, utcStampLabel } from "@/lib/projects/overview-format";
import { getReviewCopy } from "@/lib/projects/review-messages";
import type { ProjectDetail, ProjectLocation } from "@/lib/projects/types";

import { ProjectRecordTabs } from "./project-record-tabs";

import "@/styles/site-plan-projects.css";

function useAuthPart(read: () => string, server: string): string {
  return useSyncExternalStore(subscribeAuth, read, () => server);
}

function placeLine(location: ProjectLocation | null | undefined): string {
  if (!location) return "";
  const parts = [location.roadName, location.locality, location.district, location.province].filter((part) => part && part.trim());
  return parts.join(", ");
}

type TransitionAction = "SUBMIT" | "HOLD" | "RESUME" | "REOPEN";

function OverviewBody({
  project,
  copy,
  statusText,
  listQuery,
  pending,
  notice,
  reviewLabel,
  financial,
  onTransition,
}: {
  project: ProjectDetail;
  copy: ReturnType<typeof getProjectCopy>;
  statusText: string;
  listQuery: string | null;
  pending: boolean;
  notice: string | null;
  reviewLabel: string;
  financial: { value: number | null; withheld: boolean };
  onTransition: (action: TransitionAction, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const needsReason = Boolean(project.availableActions?.includes("HOLD") || project.availableActions?.includes("RESUME"));
  const gaps = project.submissionGaps ?? [];
  const canSubmit = Boolean(project.availableActions?.includes("SUBMIT")) && gaps.length === 0;
  const hasAction = canSubmit || needsReason || Boolean(project.availableActions?.includes("REOPEN"));
  const gapText = (gap: string) =>
    gap === "dates" ? copy.gapDates : gap === "geometry" ? copy.gapGeometry : gap === "location" ? copy.gapLocation : gap === "budget" ? copy.gapBudget : copy.gapIdentity;
  return (
    <>
      <section className="sp-surface spp-identity" aria-labelledby="project-overview-title">
        <div className="spp-identity-top">
          <div className="spp-identity-main">
            <p className="spp-code">{project.projectCode}</p>
            <h2 id="project-overview-title">{project.title}</h2>
            <p className="spp-meta">
              <span className="spp-tag">{copy.types[project.projectType as keyof typeof copy.types] ?? project.projectType}</span>
              <span className="spp-tag">{project.agencyCode ?? project.agencyId}</span>
              <span>
                {copy.fieldManager}: <strong>{project.managerName?.trim() || copy.notProvided}</strong>
              </span>
            </p>
          </div>
          <div className="spp-identity-status">
            <StatusChip domain="project" status={project.status} label={statusText} />
          </div>
        </div>
        <LifecycleRail status={project.status} />
      </section>

      {project.status === "DRAFT" ? <p className="spp-note" role="status">{copy.draftOverview}</p> : null}
      {project.status === "SUBMITTED" || project.status === "UNDER_REVIEW" ? <p className="spp-note" role="note">{copy.waitingReview}</p> : null}
      {project.status === "REJECTED" ? <p className="spp-note is-critical" role="note">{copy.rejectedNote}</p> : null}
      {project.reviewDecision?.reason ? (
        <p className="spp-note" role="status">
          <strong>{copy.decisionReason}:</strong> {project.reviewDecision.reason}
        </p>
      ) : null}

      {project.canEditDraft || (project.availableReviewActions && project.availableReviewActions.length > 0) ? (
        <div className="spp-actions">
          {project.canEditDraft ? (
            <Link className="spp-btn" href={`/projects/${project.id}/edit${listQuery ? `?list=${encodeURIComponent(listQuery)}` : ""}`}>
              {copy.editDraft}
            </Link>
          ) : null}
          {project.availableReviewActions && project.availableReviewActions.length > 0 ? (
            <Link className="spp-btn" href={`/projects/${project.id}/review`}>
              {reviewLabel}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="spp-cols">
        <div className="spp-col">
          <section className="sp-surface spp-panel" aria-labelledby="project-description">
            <h3 id="project-description">{copy.sectionDescription}</h3>
            <p className="spp-prose">{project.description?.trim() ? project.description : copy.notProvided}</p>
          </section>
          <section className="sp-surface spp-panel" aria-labelledby="project-schedule">
            <h3 id="project-schedule">{copy.sectionSchedule}</h3>
            <FactsList
              facts={[
                { label: copy.fieldStart, value: utcDateLabel(project.startDate, ""), missing: copy.notProvided },
                { label: copy.fieldEnd, value: utcDateLabel(project.plannedEndDate, ""), missing: copy.notProvided },
                { label: copy.fieldActualEnd, value: utcDateLabel(project.actualEndDate, ""), missing: copy.notProvided },
                { label: copy.fieldUpdated, value: utcStampLabel(project.updatedAt, ""), missing: copy.notProvided },
              ]}
            />
          </section>
          <section className="sp-surface spp-panel" aria-labelledby="project-place">
            <h3 id="project-place">{copy.sectionPlace}</h3>
            <FactsList
              facts={[
                { label: copy.sectionPlace, value: placeLine(project.location), missing: copy.notProvided },
                { label: copy.fieldPlaceNote, value: project.location?.description?.trim() || "", missing: copy.notProvided },
                { label: copy.fieldGeometry, value: geometrySummary(project.geometry, ""), missing: copy.notProvided },
              ]}
            />
          </section>
          <ProjectContractorsCard projectId={project.id} projectLabel={`${project.projectCode} ${project.title}`} />
        </div>

        <div className="spp-col">
          {hasAction || gaps.length > 0 || notice ? (
            <section className="sp-surface spp-panel spp-next" aria-labelledby="project-lifecycle">
              <h3 id="project-lifecycle">{copy.lifecycleTitle}</h3>
              <p className="spp-small">{copy.lifecycleNote}</p>
              {gaps.length > 0 ? (
                <div className="spp-gaps" role="status">
                  <p>{copy.submissionNeeds}</p>
                  <ul>
                    {gaps.map((gap) => (
                      <li key={gap}>{gapText(gap)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {notice ? <p className="spp-notice" role="alert">{notice}</p> : null}
              {needsReason ? (
                <div className="spp-field">
                  <label htmlFor="project-lifecycle-reason">{copy.reasonLabel}</label>
                  <input id="project-lifecycle-reason" className="spp-input" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
                </div>
              ) : null}
              <div className="spp-actions">
                {canSubmit ? (
                  <button type="button" className="spp-btn is-primary" disabled={pending} onClick={() => onTransition("SUBMIT")}>
                    {pending ? copy.lifecycleWorking : copy.submitForReview}
                  </button>
                ) : null}
                {project.availableActions?.includes("HOLD") ? (
                  <button type="button" className="spp-btn" disabled={pending || reason.trim().length === 0} onClick={() => onTransition("HOLD", reason.trim())}>
                    {copy.holdProject}
                  </button>
                ) : null}
                {project.availableActions?.includes("RESUME") ? (
                  <button type="button" className="spp-btn" disabled={pending || reason.trim().length === 0} onClick={() => onTransition("RESUME", reason.trim())}>
                    {copy.resumeProject}
                  </button>
                ) : null}
                {project.availableActions?.includes("REOPEN") ? (
                  <button type="button" className="spp-btn" disabled={pending} onClick={() => onTransition("REOPEN")}>
                    {pending ? copy.lifecycleWorking : copy.reopenDraft}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="sp-surface spp-panel" aria-labelledby="project-progress">
            <h3 id="project-progress">{copy.sectionRecorded}</h3>
            <DualProgress
              physical={typeof project.physicalProgress === "number" ? project.physicalProgress : null}
              financial={financial.value}
              financialWithheld={financial.withheld}
              names={{ physical: copy.physicalProgress, financial: "Financial progress" }}
            />
            <p className="spp-small">{copy.progressNote}</p>
            <p className="spp-small">{copy.overviewOnly}</p>
          </section>

          {project.budget ? (
            <section className="sp-surface spp-panel" aria-labelledby="project-budget">
              <h3 id="project-budget">
                {copy.sectionBudget} <HonestyChip kind="provisional" />
              </h3>
              <p className="spp-money">{lkrBudgetLabel(project.budget.amountMinor, copy.notProvided)}</p>
            </section>
          ) : null}
        </div>
      </div>
      <p className="spp-small">{copy.readOnly}</p>
    </>
  );
}

export function ProjectOverviewClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const epoch = useAuthPart(() => String(getAuthEpoch()), "0");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "", "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "", "");
  const [locale] = useWorkspaceLocale();
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
  const finance = useQuery({
    queryKey: financeQueryKey(epoch, userId, roleKey, id),
    queryFn: () => fetchFinancialProgress(id),
    enabled: Boolean(project.data),
    retry: false,
  });
  const transition = useMutation({
    mutationFn: (input: { action: TransitionAction; reason?: string }) => {
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
  const financeStatus = finance.error ? (finance.error instanceof ApiError ? finance.error.status : 0) : null;
  const financial = financialForBar(finance.data?.summary, financeStatus);
  const dash = getDashboardCopy(locale);

  return (
    <StaffWorkspaceShell
      title={copy.overview}
      description={project.data?.projectCode}
      wide
      context={
        <ContextBar
          crumbs={[
            { label: copy.breadcrumbProjects, href: back },
            { label: project.data?.projectCode ?? copy.overview },
          ]}
        />
      }
    >
      <ProjectRecordTabs id={id} roleKey={roleKey} copy={copy} />
      {project.isLoading ? (
        <div className="spp-cols" role="status" aria-busy="true" aria-label={copy.loadingProject}>
          <div className="mc-skel spp-skel" />
          <div className="mc-skel spp-skel" />
        </div>
      ) : null}
      {error ? (
        <div className="mc-alert is-critical" role="alert">
          <p>{error}</p>
          <button type="button" className="mc-btn" onClick={() => void project.refetch()}>{copy.retry}</button>
        </div>
      ) : null}
      {project.data ? (
        <OverviewBody
          project={project.data}
          copy={copy}
          statusText={dashboardStatusLabel(project.data.status, dash)}
          listQuery={listQuery}
          pending={transition.isPending}
          notice={notice}
          reviewLabel={getReviewCopy(locale).openReview}
          financial={financial}
          onTransition={(action, reason) => {
            setNotice(null);
            transition.mutate({ action, reason });
          }}
        />
      ) : null}
    </StaffWorkspaceShell>
  );
}
