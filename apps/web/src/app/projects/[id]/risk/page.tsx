import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ProjectRecordTabs } from "@/components/projects/project-record-tabs";
import { ProjectRiskTabClient } from "@/components/risk/project-risk-tab-client";
import { getProjectCopy } from "@/lib/projects/messages";

export const metadata: Metadata = {
  title: "Project Risk · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectRiskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const copy = getProjectCopy("en");

  return (
    <StaffWorkspaceShell title="Project Risk Intelligence" wide hidePageHeader>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link href="/projects" className="hover:text-text-primary">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/projects/${id}/overview`} className="hover:text-text-primary">
            Record
          </Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Risk Intelligence</span>
        </div>

        <ProjectRecordTabs id={id} roleKey="GOV_ADMIN" copy={copy} />

        <Suspense fallback={<p role="status" className="text-xs text-text-muted">Loading Risk Analysis…</p>}>
          <ProjectRiskTabClient projectId={id} roleKey="GOV_ADMIN" />
        </Suspense>
      </div>
    </StaffWorkspaceShell>
  );
}
