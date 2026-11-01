import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkRequestDetailClient } from "@/components/roadsync/work-request-detail-client";

export const metadata: Metadata = {
  title: "Work Request · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function WorkRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <WorkRequestDetailClient id={id} />
    </Suspense>
  );
}
