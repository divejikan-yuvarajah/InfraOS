import type { Metadata } from "next";

import { WorkspaceHome } from "@/components/auth/workspace-home";

export const metadata: Metadata = {
  title: "Inspector Field Command · INFRAOS",
  robots: { index: false, follow: false },
};

export default function InspectorDashboardPage() {
  return <WorkspaceHome initialViewMode="INSPECTOR" />;
}

