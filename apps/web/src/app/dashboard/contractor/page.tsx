import type { Metadata } from "next";

import { WorkspaceHome } from "@/components/auth/workspace-home";

export const metadata: Metadata = {
  title: "Contractor Execution Command · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ContractorDashboardPage() {
  return <WorkspaceHome initialViewMode="CONTRACTOR" />;
}

