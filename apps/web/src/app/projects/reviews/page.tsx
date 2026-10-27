import type { Metadata } from "next";
import { Suspense } from "react";

import { ReviewQueueClient } from "@/components/projects/review-queue-client";

export const metadata: Metadata = {
  title: "Project reviews · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ProjectReviewsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ReviewQueueClient />
    </Suspense>
  );
}
