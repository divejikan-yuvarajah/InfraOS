import type { Metadata } from "next";
import { Suspense } from "react";

import { ApprovalsQueue } from "@/components/roadsync/approvals-queue";

export const metadata: Metadata = {
  title: "Approvals · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ApprovalsQueue />
    </Suspense>
  );
}
