import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectReviewClient } from "@/components/projects/project-review-client";

export const metadata: Metadata = {
  title: "Review decision · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectReviewClient id={id} />
    </Suspense>
  );
}
