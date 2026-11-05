import type { Metadata } from "next";
import { Suspense } from "react";

import { InframapWorkspace } from "@/components/inframap/inframap-workspace";

export const metadata: Metadata = {
  title: "InfraMap · INFRAOS",
  robots: { index: false, follow: false },
};

// The workspace reads the shareable view state with useSearchParams, which needs a Suspense boundary.
export default function InframapPage() {
  return (
    <Suspense fallback={null}>
      <InframapWorkspace />
    </Suspense>
  );
}
