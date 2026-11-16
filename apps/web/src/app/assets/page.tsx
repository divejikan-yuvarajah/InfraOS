import type { Metadata } from "next";
import { Suspense } from "react";

import { AssetsDashboard } from "@/components/assets/assets-dashboard";
import { ContentSkeleton } from "@/components/feedback/content-skeleton";

export const metadata: Metadata = { title: "Assets · INFRAOS", robots: { index: false, follow: false } };

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="p-6"><ContentSkeleton variant="kpi" label="Loading Assets" /></div>}>
      <AssetsDashboard />
    </Suspense>
  );
}
