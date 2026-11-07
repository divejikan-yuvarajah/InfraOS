import type { Metadata } from "next";
import { Suspense } from "react";

import { MaintenanceWorkspace } from "@/components/assets/maintenance-workspace";

export const metadata: Metadata = { title: "Maintenance · INFRAOS", robots: { index: false, follow: false } };

export default function MaintenancePage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <MaintenanceWorkspace />
    </Suspense>
  );
}
