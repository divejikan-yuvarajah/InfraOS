import type { Metadata } from "next";
import { Suspense } from "react";

import { InsightsPage } from "@/components/assets/insights-page";

export const metadata: Metadata = { title: "Agency insights · INFRAOS", robots: { index: false, follow: false } };

export default function CoordinationInsightsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <InsightsPage />
    </Suspense>
  );
}
