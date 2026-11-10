import type { Metadata } from "next";
import { Suspense } from "react";
import { RiskDashboard } from "@/components/risk/risk-dashboard";

export const metadata: Metadata = {
  title: "Risk Intelligence · INFRAOS",
  description: "Explainable deterministic project risk indicators, delay, budget and cross-agency coordination monitoring.",
  robots: { index: false, follow: false },
};

export default function RiskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-text-muted">Loading Risk Intelligence…</div>}>
      <RiskDashboard />
    </Suspense>
  );
}
