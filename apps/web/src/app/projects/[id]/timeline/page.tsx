import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectTimelineClient } from "@/components/projects/project-timeline-client";

export const metadata: Metadata = {
  title: "Project timeline · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectTimelineClient id={id} />
    </Suspense>
  );
}
