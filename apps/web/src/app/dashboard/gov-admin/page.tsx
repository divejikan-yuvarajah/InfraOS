import type { Metadata } from "next";

import { WorkspaceHome } from "@/components/auth/workspace-home";

export const metadata: Metadata = {
  title: "Government Infrastructure Command · INFRAOS",
  robots: { index: false, follow: false },
};

export default function GovAdminDashboardPage() {
  return <WorkspaceHome initialViewMode="GOV_ADMIN" />;
}

