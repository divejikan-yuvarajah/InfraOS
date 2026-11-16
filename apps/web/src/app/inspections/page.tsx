import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { InspectionsDashboard } from "@/components/inspections/inspections-dashboard";

export const metadata: Metadata = {
  title: "Inspections · INFRAOS",
  robots: { index: false, follow: false },
};

export default function InspectionsPage() {
  return (
    <Suspense fallback={<div className="p-6"><ContentSkeleton variant="kpi" label="Loading Inspections" /></div>}>
      <InspectionsDashboard />
    </Suspense>
  );
}
