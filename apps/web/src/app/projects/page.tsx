import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectsPageClient } from "@/components/projects/projects-page-client";

export const metadata: Metadata = {
  title: "Projects · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectsPageClient />
    </Suspense>
  );
}
