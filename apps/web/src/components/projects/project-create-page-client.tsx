"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { WorkspaceContext } from "@/components/projects/project-record-nav";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import { createProject } from "@/lib/projects/api";
import { classifyCreateError, type CreateFailure } from "@/lib/projects/create-outcome";
import { projectCreateCachePlan, type ProjectCreateRequest } from "@/lib/projects/create-transform";
import { getProjectCopy } from "@/lib/projects/messages";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { ProjectCreateForm } from "./project-create-form";

export function ProjectCreatePageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [locale] = useWorkspaceLocale();
  const [failure, setFailure] = useState<CreateFailure | null>(null);
  const copy = getProjectCopy(locale);
  const roleKey = getMemorySession()?.user.roleKey ?? "";
  const platformAdmin = roleKey === "SUPER_ADMIN";
  // Only the platform administrator picks an owning agency; the server re-validates it.
  const agencies = useQuery({
    queryKey: ["project-create-agencies", String(getAuthEpoch()), getMemorySession()?.user.id ?? "", roleKey],
    queryFn: () => fetchAgencies({ status: "ACTIVE" }),
    enabled: platformAdmin,
    retry: false,
  });

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
    <StaffWorkspaceShell title={copy.createTitle} description={copy.createSubtitle} wide context={<WorkspaceContext locale={locale} current={copy.createTitle} projects />}>
      {locale !== "en" ? <p className="spp-small">{copy.nativeReview}</p> : null}
      <ProjectCreateForm
        copy={copy}
        failure={failure}
        pending={mutation.isPending}
        agencyChoice={
          platformAdmin
            ? {
                options: (agencies.data?.agencies ?? []).map((agency) => ({ id: agency.id, label: `${agency.name} (${agency.code})` })),
                unavailable: agencies.isError,
              }
            : null
        }
        onCancel={() => router.push("/projects")}
        onSubmitBody={async (body) => {
          setFailure(null);
          await mutation.mutateAsync(body);
        }}
      />
    </StaffWorkspaceShell>
  );
}
