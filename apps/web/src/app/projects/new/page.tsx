import type { Metadata } from "next";

import { ProjectCreatePageClient } from "@/components/projects/project-create-page-client";

export const metadata: Metadata = {
  title: "Create Project · INFRAOS",
  robots: { index: false, follow: false },
};

export default function CreateProjectPage() {
  return <ProjectCreatePageClient />;
}
