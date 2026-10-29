import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectActivityClient } from "@/components/projects/project-activity-client";

export const metadata: Metadata = {
  title: "Activity history · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectActivityClient id={id} />
    </Suspense>
  );
}
