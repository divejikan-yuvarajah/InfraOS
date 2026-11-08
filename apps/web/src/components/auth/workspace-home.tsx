"use client";

import { ProjectDashboard } from "@/components/projects/project-dashboard";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

export function WorkspaceHome() {
  const [locale] = useWorkspaceLocale();
  const copy = getDashboardCopy(locale);
  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide hidePageHeader>
      <ProjectDashboard locale={locale} />
    </StaffWorkspaceShell>
  );
}
