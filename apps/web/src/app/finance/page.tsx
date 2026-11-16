import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";

export const metadata: Metadata = {
  title: "Finance · INFRAOS",
  robots: { index: false, follow: false },
};

export default function FinancePage() {
  return (
    <Suspense fallback={<div className="p-6"><ContentSkeleton variant="kpi" label="Loading Finance" /></div>}>
      <FinanceDashboard />
    </Suspense>
  );
}
