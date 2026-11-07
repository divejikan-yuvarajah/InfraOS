import type { Metadata } from "next";
import { Suspense } from "react";

import { AssetsDashboard } from "@/components/assets/assets-dashboard";

export const metadata: Metadata = { title: "Assets · INFRAOS", robots: { index: false, follow: false } };

export default function AssetsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <AssetsDashboard />
    </Suspense>
  );
}
