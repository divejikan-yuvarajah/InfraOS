import type { Metadata } from "next";

import { WorkspaceHome } from "@/components/auth/workspace-home";

export const metadata: Metadata = {
  title: "Workspace · INFRAOS",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <WorkspaceHome />;
}
