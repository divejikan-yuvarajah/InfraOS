import type { Metadata } from "next";
import { Suspense } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { DashboardBrief } from "@/components/roadsync/dashboard-brief";

export const metadata: Metadata = {
  title: "Coordination Briefing · INFRAOS",
  robots: { index: false, follow: false },
};

export default function DashboardBriefPage() {
  return (
    <StaffWorkspaceShell title="Briefing" description="Printable coordination briefing." wide>
      <Suspense fallback={<p role="status">Loading</p>}>
        <DashboardBrief />
      </Suspense>
    </StaffWorkspaceShell>
  );
}
