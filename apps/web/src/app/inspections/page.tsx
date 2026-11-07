import type { Metadata } from "next";
import { Suspense } from "react";

import { InspectionsDashboard } from "@/components/inspections/inspections-dashboard";

export const metadata: Metadata = {
  title: "Inspections · INFRAOS",
  robots: { index: false, follow: false },
};

export default function InspectionsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <InspectionsDashboard />
    </Suspense>
  );
}
