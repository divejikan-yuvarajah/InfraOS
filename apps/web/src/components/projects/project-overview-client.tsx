"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { fetchProject } from "@/lib/projects/api";
import { getProjectCopy, projectReadMessage } from "@/lib/projects/messages";
import { ApiError } from "@/lib/api/client";

export function ProjectOverviewClient({ id }: { id: string }) {
  const copy = getProjectCopy("en");
  const project = useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: () => fetchProject(id),
    retry: false,
  });
  const error = project.error instanceof ApiError ? projectReadMessage(project.error.status, copy) : project.error ? copy.unavailable : null;

  return (
    <StaffWorkspaceShell title={copy.overview} description={project.data?.title} wide>
      <p><Link href="/projects">Back to projects</Link></p>
      {project.isLoading ? <p role="status">Loading</p> : null}
      {error ? <p className="auth-access-banner error" role="alert">{error}</p> : null}
      {project.data ? (
        <section className="auth-access-card" aria-labelledby="project-overview">
          <h2 id="project-overview">{project.data.projectCode}</h2>
          <p>{project.data.description ?? copy.noDescription}</p>
          <p>Status {project.data.status}. Type {project.data.projectType}. Agency {project.data.agencyCode ?? project.data.agencyId}.</p>
          {project.data.budget ? <p>LKR cents {project.data.budget.amountMinor}</p> : null}
          {project.data.status === "DRAFT" ? <p role="status">{copy.draftOverview}</p> : null}
          <p>This overview is read-only. Submission, approval, and milestones are later steps.</p>
        </section>
      ) : null}
    </StaffWorkspaceShell>
  );
}
