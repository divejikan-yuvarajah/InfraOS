import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { RiskMethodologyClient } from "@/components/risk/risk-methodology";

export const metadata: Metadata = {
  title: "Risk Methodology & Rules Catalog · INFRAOS",
  description: "Auditable deterministic risk rules catalog, scoring definitions, and data readiness statistics.",
  robots: { index: false, follow: false },
};

export default function RiskMethodologyPage() {
  return (
    <StaffWorkspaceShell title="Risk Methodology & Catalog" wide hidePageHeader>
      <Suspense fallback={<p role="status" className="text-xs text-text-muted p-8 text-center">Loading Methodology Catalog…</p>}>
        <RiskMethodologyClient />
      </Suspense>
    </StaffWorkspaceShell>
  );
}
