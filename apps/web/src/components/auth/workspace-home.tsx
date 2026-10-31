"use client";

import { useState } from "react";

import { ProjectDashboard } from "@/components/projects/project-dashboard";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import type { AuthLocale } from "@/lib/auth/types";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";

export function WorkspaceHome() {
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getDashboardCopy(locale);
  return (
    <StaffWorkspaceShell title={copy.title} description={copy.description} wide>
      <ProjectDashboard locale={locale} onLocale={setLocale} />
    </StaffWorkspaceShell>
  );
}
