import type { Metadata } from "next";

import { WorkspaceHome } from "@/components/auth/workspace-home";

export const metadata: Metadata = {
  title: "Super Admin Command · INFRAOS",
  robots: { index: false, follow: false },
};

export default function SuperAdminDashboardPage() {
  return <WorkspaceHome initialViewMode="SUPER_ADMIN" />;
}

