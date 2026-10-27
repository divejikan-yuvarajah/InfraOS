import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectEditPageClient } from "@/components/projects/project-edit-page-client";

export const metadata: Metadata = {
  title: "Edit project draft · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectEditPageClient id={id} />
    </Suspense>
  );
}
