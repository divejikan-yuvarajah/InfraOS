import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { CommandCenter } from "@/components/roadsync/command-center";

export const metadata: Metadata = {
  title: "RoadSync Dashboard · INFRAOS",
  robots: { index: false, follow: false },
};

export default function RoadsyncDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6"><ContentSkeleton variant="kpi" label="Loading RoadSync" /></div>}>
      <CommandCenter />
    </Suspense>
  );
}
