import type { Metadata } from "next";

import { ProjectOverviewClient } from "@/components/projects/project-overview-client";

export const metadata: Metadata = {
  title: "Project overview · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectOverviewClient id={id} />;
}
