import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectProgressClient } from "@/components/projects/project-progress-client";

export const metadata: Metadata = {
  title: "Physical progress · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectProgressClient id={id} />
    </Suspense>
  );
}
