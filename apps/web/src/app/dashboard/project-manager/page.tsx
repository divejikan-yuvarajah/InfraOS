import type { Metadata } from "next";

import { WorkspaceHome } from "@/components/auth/workspace-home";

export const metadata: Metadata = {
  title: "Project Manager Command · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ProjectManagerDashboardPage() {
  return <WorkspaceHome initialViewMode="PROJECT_MANAGER" />;
}

