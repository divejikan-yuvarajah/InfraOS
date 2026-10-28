import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectMilestonesClient } from "@/components/projects/project-milestones-client";

export const metadata: Metadata = {
  title: "Milestones · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectMilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectMilestonesClient id={id} />
    </Suspense>
  );
}
