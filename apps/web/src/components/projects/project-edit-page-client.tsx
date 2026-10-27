"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProject, patchProject } from "@/lib/projects/api";
import { classifyEditError, type EditFailure } from "@/lib/projects/edit-outcome";
import { projectEditCachePlan, type ProjectPatchRequest } from "@/lib/projects/edit-transform";
import { getProjectCopy, projectReadMessage } from "@/lib/projects/messages";
import { projectCoreQueryKey, safeListReturn } from "@/lib/projects/overview-format";

import { ProjectEditForm } from "./project-edit-form";

function useAuthPart(read: () => string, server: string): string {
  return useSyncExternalStore(subscribeAuth, read, () => server);
}

export function ProjectEditPageClient({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const epoch = useAuthPart(() => String(getAuthEpoch()), "0");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "", "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "", "");
  const [locale, setLocale] = useState<AuthLocale>("en");
  const [failure, setFailure] = useState<EditFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const copy = getProjectCopy(locale);
  const listRaw = searchParams.get("list");
  const backOverview = `/projects/${id}/overview${listRaw ? `?list=${encodeURIComponent(listRaw)}` : ""}`;

  const project = useQuery({
    queryKey: projectCoreQueryKey(epoch, userId, roleKey, id),
    queryFn: () => fetchProject(id),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (body: ProjectPatchRequest) => patchProject(id, body),
    retry: false,
    onSuccess: (result) => {
      const plan = projectEditCachePlan({
        startedEpoch: result.epoch,
        startedToken: result.token,
        currentEpoch: getAuthEpoch(),
        currentToken: getMemoryAccessToken(),
        userId: getMemorySession()?.user.id ?? "",
        roleKey: getMemorySession()?.user.roleKey ?? "",
        projectId: id,
        listQuery: listRaw,
      });
      if (!plan.invalidate || !plan.href || !plan.queryKey) {
        setFailure("stale");
        setSaved(false);
        return;
      }
      queryClient.setQueryData(plan.queryKey, result.project);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(plan.href);
    },
    onError: (error) => {
      setSaved(false);
      setFailure(classifyEditError(error));
    },
  });

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const loadError = project.error instanceof ApiError
    ? projectReadMessage(project.error.status, copy)
    : project.error
      ? (offline ? copy.offline : copy.unavailable)
      : null;

  const editable = project.data?.canEditDraft === true && project.data.status === "DRAFT";

  return (
    <StaffWorkspaceShell title={copy.editTitle} description={project.data?.projectCode} wide>
      <nav className="auth-access-locale-row" aria-label="Breadcrumb">
        <Link href="/dashboard">{copy.breadcrumbWorkspace}</Link>
        <span aria-hidden="true">/</span>
        <Link href="/projects">{copy.breadcrumbProjects}</Link>
        <span aria-hidden="true">/</span>
        <Link href={backOverview}>{copy.overview}</Link>
        <span aria-hidden="true">/</span>
        <span>{copy.breadcrumbEdit}</span>
      </nav>
      <p><Link href={safeListReturn(listRaw)}>{copy.backToList}</Link></p>
      <section className="auth-access-card" aria-labelledby="project-edit-locale">
        <p id="project-edit-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Project language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code === "en" ? "English" : code === "si" ? "සිංහල" : "தமிழ்"}
            </button>
          ))}
        </div>
        <p role="note">{copy.nativeReview}</p>
      </section>
      <p className="auth-access-hint">{copy.editSubtitle}</p>
      {project.isLoading ? <p role="status">{copy.loadingProject}</p> : null}
      {loadError ? (
        <div className="auth-access-banner error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="auth-access-button" onClick={() => void project.refetch()}>{copy.retry}</button>
        </div>
      ) : null}
      {project.data && !editable ? (
        <div className="auth-access-banner error" role="alert">
          <p>{project.data.status === "DRAFT" ? copy.editForbidden : copy.editNoLongerDraft}</p>
          <Link href={backOverview}>{copy.overview}</Link>
        </div>
      ) : null}
      {project.data && editable ? (
        <ProjectEditForm
          copy={copy}
          project={project.data}
          failure={failure}
          pending={mutation.isPending}
          saved={saved}
          onReloadLatest={() => {
            setFailure(null);
            void project.refetch();
          }}
          onCancel={() => router.push(backOverview)}
          onSubmitBody={async (body) => {
            setFailure(null);
            setSaved(false);
            await mutation.mutateAsync(body);
          }}
        />
      ) : null}
    </StaffWorkspaceShell>
  );
}
