import type { Metadata } from "next";
import { Suspense } from "react";

import { DocTraceDashboard } from "@/components/documents/doctrace-dashboard";

export const metadata: Metadata = { title: "DocTrace · INFRAOS", robots: { index: false, follow: false } };

export default function DocumentsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <DocTraceDashboard />
    </Suspense>
  );
}
