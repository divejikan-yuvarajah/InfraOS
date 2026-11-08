"use client";

import { ProjectDashboard, type CommandViewMode } from "@/components/projects/project-dashboard";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

export function WorkspaceHome({
  initialViewMode = "ROLE_DEFAULT",
}: {
  initialViewMode?: CommandViewMode;
}) {
  const [locale] = useWorkspaceLocale();
  const copy = getDashboardCopy(locale);
  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide hidePageHeader>
      <ProjectDashboard locale={locale} initialViewMode={initialViewMode} />
    </StaffWorkspaceShell>
  );
}
