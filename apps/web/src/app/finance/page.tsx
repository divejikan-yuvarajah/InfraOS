import type { Metadata } from "next";
import { Suspense } from "react";

import { FinanceDashboard } from "@/components/finance/finance-dashboard";

export const metadata: Metadata = {
  title: "Finance · INFRAOS",
  robots: { index: false, follow: false },
};

export default function FinancePage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <FinanceDashboard />
    </Suspense>
  );
}
