import type { Metadata } from "next";

import { ProjectsPageClient } from "@/components/projects/projects-page-client";

export const metadata: Metadata = {
  title: "Projects · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ProjectsPage() {
  return <ProjectsPageClient />;
}
