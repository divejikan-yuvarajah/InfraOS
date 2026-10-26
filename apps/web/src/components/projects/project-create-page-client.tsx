"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { createProject } from "@/lib/projects/api";
import { classifyCreateError, type CreateFailure } from "@/lib/projects/create-outcome";
import { projectCreateCachePlan, type ProjectCreateRequest } from "@/lib/projects/create-transform";
import { getProjectCopy } from "@/lib/projects/messages";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";

import { ProjectCreateForm } from "./project-create-form";

export function ProjectCreatePageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<AuthLocale>("en");
  const [failure, setFailure] = useState<CreateFailure | null>(null);
  const copy = getProjectCopy(locale);

  const mutation = useMutation({
    mutationFn: (body: ProjectCreateRequest) => createProject(body),
    retry: false,
    onSuccess: (result) => {
      const plan = projectCreateCachePlan({
        startedEpoch: result.epoch,
        startedToken: result.token,
        currentEpoch: getAuthEpoch(),
        currentToken: getMemoryAccessToken(),
        userId: getMemorySession()?.user.id ?? "",
        roleKey: getMemorySession()?.user.roleKey ?? "",
        projectId: result.project.id,
      });
      if (!plan.invalidate || !plan.href || !plan.queryKey) {
        setFailure("stale");
        return;
      }
      queryClient.setQueryData(plan.queryKey, result.project);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push(plan.href);
    },
    onError: (error) => {
      setFailure(classifyCreateError(error));
    },
  });

  return (
    <StaffWorkspaceShell title={copy.createTitle} description={copy.createSubtitle} wide>
      <nav className="auth-access-locale-row" aria-label="Breadcrumb">
        <Link href="/dashboard">{copy.breadcrumbWorkspace}</Link>
        <span aria-hidden="true">/</span>
        <Link href="/projects">{copy.breadcrumbProjects}</Link>
        <span aria-hidden="true">/</span>
        <span>{copy.breadcrumbCreate}</span>
      </nav>
      <section className="auth-access-card" aria-labelledby="project-create-locale">
        <p id="project-create-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Project language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="auth-access-status" role="status">{copy.nativeReview}</p>
      </section>
      <ProjectCreateForm
        copy={copy}
        failure={failure}
        pending={mutation.isPending}
        onCancel={() => router.push("/projects")}
        onSubmitBody={async (body) => {
          setFailure(null);
          await mutation.mutateAsync(body);
        }}
      />
    </StaffWorkspaceShell>
  );
}
