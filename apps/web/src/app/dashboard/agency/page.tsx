import type { Metadata } from "next";

import { WorkspaceHome } from "@/components/auth/workspace-home";

export const metadata: Metadata = {
  title: "Agency Operations Command · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AgencyDashboardPage() {
  return <WorkspaceHome initialViewMode="AGENCY_OFFICER" />;
}

