import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectFinanceWorkspace } from "@/components/finance/project-finance-workspace";

export const metadata: Metadata = {
  title: "Project finance · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectFinanceWorkspace projectId={id} />
    </Suspense>
  );
}
