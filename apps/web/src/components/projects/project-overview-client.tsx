"use client";

import { useQuery } from "@tanstack/react-query";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/projects/list-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProject } from "@/lib/projects/api";
import { getProjectCopy, projectReadMessage } from "@/lib/projects/messages";
import { geometrySummary, lkrBudgetLabel, projectCoreQueryKey, safeListReturn, utcDateLabel, utcStampLabel } from "@/lib/projects/overview-format";
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

function OverviewBody({ project, copy }: { project: ProjectDetail; copy: ReturnType<typeof getProjectCopy> }) {
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
      <p role="note">{copy.readOnly}</p>
      {project.status === "DRAFT" ? <p role="status">{copy.draftOverview}</p> : null}
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
  const back = safeListReturn(searchParams.get("list"));
  const project = useQuery({
    queryKey: projectCoreQueryKey(epoch, userId, roleKey, id),
    queryFn: () => fetchProject(id),
    retry: false,
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
      {project.data ? <OverviewBody project={project.data} copy={copy} /> : null}
    </StaffWorkspaceShell>
  );
}
